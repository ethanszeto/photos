"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  clampZoomLevel,
  clientPointToItemIndex,
  type GridLayoutMetrics,
  type ZoomLevel,
} from "@/features/gallery/lib/grid-layout";

type UseZoomGesturesOptions = {
  containerRef: RefObject<HTMLElement | null>;
  layoutRef: RefObject<GridLayoutMetrics | null>;
  itemCountRef: RefObject<number>;
  zoomLevel: ZoomLevel;
  onAwarenessZoom: (delta: 1 | -1, focalItemIndex: number) => void;
};

/** Pinch and ctrl+wheel zoom attached to the gallery scroll container. */
export function useZoomGestures({
  containerRef,
  layoutRef,
  itemCountRef,
  zoomLevel,
  onAwarenessZoom,
}: UseZoomGesturesOptions) {
  const pinchRef = useRef<{ distance: number; level: ZoomLevel } | null>(null);
  const onAwarenessZoomRef = useRef(onAwarenessZoom);

  useEffect(() => {
    onAwarenessZoomRef.current = onAwarenessZoom;
  }, [onAwarenessZoom]);

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

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      pinchRef.current = {
        distance: getTouchDistance(event.touches),
        level: layoutRef.current?.zoomLevel ?? zoomLevel,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchRef.current) return;
      event.preventDefault();

      const distance = getTouchDistance(event.touches);
      const scale = distance / pinchRef.current.distance;
      const { x, y } = getTouchCentroid(event.touches);
      const focalIndex = focalFromClientPoint(x, y);

      if (scale > 1.2) {
        const next = clampZoomLevel(pinchRef.current.level + 1);
        if (next !== pinchRef.current.level) {
          onAwarenessZoomRef.current(1, focalIndex);
          pinchRef.current = { distance, level: next };
        }
      } else if (scale < 0.83) {
        const next = clampZoomLevel(pinchRef.current.level - 1);
        if (next !== pinchRef.current.level) {
          onAwarenessZoomRef.current(-1, focalIndex);
          pinchRef.current = { distance, level: next };
        }
      }
    };

    const onTouchEnd = () => {
      pinchRef.current = null;
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const focalIndex = focalFromClientPoint(event.clientX, event.clientY);
      if (event.deltaY < 0) {
        onAwarenessZoomRef.current(1, focalIndex);
      } else if (event.deltaY > 0) {
        onAwarenessZoomRef.current(-1, focalIndex);
      }
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("wheel", onWheel);
    };
  }, [containerRef, layoutRef, itemCountRef, zoomLevel]);
}
