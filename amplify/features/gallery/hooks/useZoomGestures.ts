"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  clampPinchVisualScale,
  clientPointToItemIndex,
  targetZoomLevelFromPinch,
  type GridLayoutMetrics,
  type ZoomLevel,
} from "@/features/gallery/lib/grid-layout";

const SNAP_BACK_MS = 180;

type PinchSession = {
  startDistance: number;
  lastScale: number;
  baseLevel: ZoomLevel;
  focalItemIndex: number;
  viewportOffsetY: number;
};

type UseZoomGesturesOptions = {
  containerRef: RefObject<HTMLElement | null>;
  transformRef: RefObject<HTMLElement | null>;
  layoutRef: RefObject<GridLayoutMetrics | null>;
  itemCountRef: RefObject<number>;
  zoomLevel: ZoomLevel;
  onCommitZoom: (targetLevel: ZoomLevel, focalItemIndex: number, viewportOffsetY: number) => void;
  onStepZoom: (delta: 1 | -1, focalItemIndex: number, viewportOffsetY: number) => void;
};

function applyVisualScale(element: HTMLElement, scale: number, originX: number, originY: number) {
  element.style.transition = "none";
  element.style.transformOrigin = `${originX}px ${originY}px`;
  element.style.transform = scale === 1 ? "" : `scale(${scale})`;
}

function resetTransformInstant(element: HTMLElement) {
  element.style.transition = "none";
  element.style.transform = "";
}

function snapBackTransform(element: HTMLElement) {
  element.style.transition = `transform ${SNAP_BACK_MS}ms ease-out`;
  element.style.transform = "scale(1)";

  const onEnd = () => {
    element.style.transition = "";
    element.style.transform = "";
    element.removeEventListener("transitionend", onEnd);
  };
  element.addEventListener("transitionend", onEnd);
}

/** Pinch applies a live CSS scale; level commits on release. Ctrl+wheel stays stepped. */
export function useZoomGestures({
  containerRef,
  transformRef,
  layoutRef,
  itemCountRef,
  zoomLevel,
  onCommitZoom,
  onStepZoom,
}: UseZoomGesturesOptions) {
  const pinchRef = useRef<PinchSession | null>(null);
  const onCommitZoomRef = useRef(onCommitZoom);
  const onStepZoomRef = useRef(onStepZoom);

  useEffect(() => {
    onCommitZoomRef.current = onCommitZoom;
  }, [onCommitZoom]);

  useEffect(() => {
    onStepZoomRef.current = onStepZoom;
  }, [onStepZoom]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const focalFromClientPoint = (clientX: number, clientY: number) => {
      const currentLayout = layoutRef.current;
      const count = itemCountRef.current;
      if (!currentLayout || count <= 0) return 0;
      return clientPointToItemIndex(clientX, clientY, element, currentLayout, count);
    };

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const getTouchCentroid = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    const transformOriginFromClientPoint = (clientX: number, clientY: number) => {
      const transformEl = transformRef.current;
      if (!transformEl) return { originX: 0, originY: 0 };
      const rect = transformEl.getBoundingClientRect();
      return { originX: clientX - rect.left, originY: clientY - rect.top };
    };

    const finishPinch = (scale: number) => {
      const session = pinchRef.current;
      const transformEl = transformRef.current;
      pinchRef.current = null;

      if (!session || !transformEl || session.startDistance <= 0) {
        if (transformEl) resetTransformInstant(transformEl);
        return;
      }

      const targetLevel = targetZoomLevelFromPinch(session.baseLevel, scale);

      if (targetLevel !== session.baseLevel) {
        resetTransformInstant(transformEl);
        onCommitZoomRef.current(targetLevel, session.focalItemIndex, session.viewportOffsetY);
        return;
      }

      snapBackTransform(transformEl);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;

      const distance = getTouchDistance(event.touches);
      if (distance <= 0) return;

      const { x, y } = getTouchCentroid(event.touches);
      const rect = element.getBoundingClientRect();

      pinchRef.current = {
        startDistance: distance,
        lastScale: 1,
        baseLevel: layoutRef.current?.zoomLevel ?? zoomLevel,
        focalItemIndex: focalFromClientPoint(x, y),
        viewportOffsetY: y - rect.top,
      };

      const transformEl = transformRef.current;
      if (transformEl) {
        transformEl.style.transition = "none";
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchRef.current) return;
      event.preventDefault();

      const distance = getTouchDistance(event.touches);
      if (distance <= 0 || pinchRef.current.startDistance <= 0) return;

      const rawScale = distance / pinchRef.current.startDistance;
      const scale = clampPinchVisualScale(rawScale, pinchRef.current.baseLevel);
      pinchRef.current.lastScale = scale;
      const { x, y } = getTouchCentroid(event.touches);
      const rect = element.getBoundingClientRect();
      const { originX, originY } = transformOriginFromClientPoint(x, y);

      pinchRef.current.focalItemIndex = focalFromClientPoint(x, y);
      pinchRef.current.viewportOffsetY = y - rect.top;

      const transformEl = transformRef.current;
      if (transformEl) {
        applyVisualScale(transformEl, scale, originX, originY);
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (pinchRef.current == null) return;
      if (event.touches.length >= 2) return;

      finishPinch(pinchRef.current.lastScale);
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const focalIndex = focalFromClientPoint(event.clientX, event.clientY);
      const viewportOffsetY = event.clientY - rect.top;
      if (event.deltaY < 0) {
        onStepZoomRef.current(1, focalIndex, viewportOffsetY);
      } else if (event.deltaY > 0) {
        onStepZoomRef.current(-1, focalIndex, viewportOffsetY);
      }
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    element.addEventListener("touchcancel", onTouchEnd, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
      element.removeEventListener("wheel", onWheel);
    };
  }, [containerRef, transformRef, layoutRef, itemCountRef, zoomLevel]);
}
