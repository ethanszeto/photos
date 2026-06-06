"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_THRESHOLD_PX = 48;

type Point = { x: number; y: number };

type TouchPoint = { clientX: number; clientY: number };

type ViewerZoomableImageProps = {
  src: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

function getTouchDistance(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function getTouchMidpoint(a: TouchPoint, b: TouchPoint): Point {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

/** Pinch-zoom and pan for a single photo in the fullscreen viewer. */
export function ViewerZoomableImage({ src, onSwipeLeft, onSwipeRight }: ViewerZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const translateRef = useRef<Point>({ x: 0, y: 0 });
  const pinchRef = useRef<{ distance: number; scale: number; midpoint: Point } | null>(null);
  const panRef = useRef<{ start: Point; base: Point } | null>(null);
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null);

  const applyTransform = useCallback((nextScale: number, nextTranslate: Point) => {
    const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    const next = clampedScale <= MIN_SCALE ? { x: 0, y: 0 } : nextTranslate;
    scaleRef.current = clampedScale;
    translateRef.current = next;
    setScale(clampedScale);
    setTranslate(next);
  }, []);

  const resetTransform = useCallback(() => {
    applyTransform(MIN_SCALE, { x: 0, y: 0 });
  }, [applyTransform]);

  const zoomAroundPoint = useCallback((nextScale: number, focal: Point) => {
    const currentScale = scaleRef.current;
    const currentTranslate = translateRef.current;
    const container = containerRef.current;
    if (!container) {
      applyTransform(nextScale, currentTranslate);
      return;
    }

    const rect = container.getBoundingClientRect();
    const focalX = focal.x - rect.left - rect.width / 2;
    const focalY = focal.y - rect.top - rect.height / 2;
    const ratio = nextScale / currentScale;

    applyTransform(nextScale, {
      x: currentTranslate.x * ratio + focalX * (1 - ratio),
      y: currentTranslate.y * ratio + focalY * (1 - ratio),
    });
  }, [applyTransform]);

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      swipeRef.current = null;
      panRef.current = null;
      pinchRef.current = {
        distance: getTouchDistance(event.touches[0], event.touches[1]),
        scale: scaleRef.current,
        midpoint: getTouchMidpoint(event.touches[0], event.touches[1]),
      };
      return;
    }

    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (scaleRef.current > MIN_SCALE) {
      panRef.current = {
        start: { x: touch.clientX, y: touch.clientY },
        base: { ...translateRef.current },
      };
      return;
    }

    swipeRef.current = { startX: touch.clientX, startY: touch.clientY };
  };

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault();
      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      const midpoint = getTouchMidpoint(event.touches[0], event.touches[1]);
      const nextScale = pinchRef.current.scale * (distance / pinchRef.current.distance);
      zoomAroundPoint(nextScale, midpoint);
      return;
    }

    if (event.touches.length === 1 && panRef.current && scaleRef.current > MIN_SCALE) {
      event.preventDefault();
      const touch = event.touches[0];
      const dx = touch.clientX - panRef.current.start.x;
      const dy = touch.clientY - panRef.current.start.y;
      const next = {
        x: panRef.current.base.x + dx,
        y: panRef.current.base.y + dy,
      };
      translateRef.current = next;
      setTranslate(next);
    }
  }, [zoomAroundPoint]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => node.removeEventListener("touchmove", handleTouchMove);
  }, [handleTouchMove]);

  const onTouchEnd = (event: React.TouchEvent) => {
    if (pinchRef.current && event.touches.length < 2) {
      pinchRef.current = null;
      if (scaleRef.current < 1.05) resetTransform();
      return;
    }

    if (panRef.current && event.touches.length === 0) {
      panRef.current = null;
      return;
    }

    if (scaleRef.current > MIN_SCALE || !swipeRef.current) return;

    const endX = event.changedTouches[0]?.clientX;
    const endY = event.changedTouches[0]?.clientY;
    if (endX == null || endY == null) return;

    const deltaX = endX - swipeRef.current.startX;
    const deltaY = endY - swipeRef.current.startY;
    swipeRef.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX < 0) onSwipeLeft();
    else onSwipeRight();
  };

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    zoomAroundPoint(scaleRef.current + delta, { x: event.clientX, y: event.clientY });
  };

  const onDoubleClick = (event: React.MouseEvent) => {
    if (scaleRef.current > MIN_SCALE) {
      resetTransform();
      return;
    }
    zoomAroundPoint(2, { x: event.clientX, y: event.clientY });
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full touch-none items-center justify-center overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="flex items-center justify-center"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full select-none object-contain"
          style={{ maxHeight: "100%", maxWidth: "100%" }}
          draggable={false}
        />
      </div>
    </div>
  );
}
