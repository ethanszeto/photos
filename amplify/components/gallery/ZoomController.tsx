"use client";

import {
  clampZoomLevel,
  computeGridLayout,
  getDefaultZoomLevel,
  type GridLayoutMetrics,
  type ZoomLevel,
} from "@/lib/gallery-grid-layout";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type { GridLayoutMetrics, ZoomLevel };
export { GALLERY_ZOOM_LEVELS, getDefaultZoomLevel, ZOOM_LEVEL_COUNT } from "@/lib/gallery-grid-layout";

type ZoomContextValue = {
  zoomLevel: ZoomLevel;
  layout: GridLayoutMetrics;
  setZoomLevel: (level: ZoomLevel) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

const ZoomContext = createContext<ZoomContextValue | null>(null);

type ZoomProviderProps = {
  children: ReactNode;
  /** Attach pinch / ctrl+wheel handlers to this element. */
  containerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Manages Apple Photos-style zoom levels.
 * Layout metrics come from gallery-zoom-levels.json via computeGridLayout.
 */
export function ZoomProvider({ children, containerRef }: ZoomProviderProps) {
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(getDefaultZoomLevel);
  const [containerWidth, setContainerWidth] = useState(390);
  const [containerHeight, setContainerHeight] = useState(800);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const pinchRef = useRef<{ distance: number; level: ZoomLevel } | null>(null);

  const layout = useMemo(
    () =>
      computeGridLayout({
        zoomLevel,
        containerWidth,
        viewportHeight: containerHeight,
        devicePixelRatio,
      }),
    [zoomLevel, containerWidth, containerHeight, devicePixelRatio],
  );

  const setZoomLevel = useCallback((level: ZoomLevel) => {
    setZoomLevelState(clampZoomLevel(level));
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevelState((current) => clampZoomLevel(current + 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevelState((current) => clampZoomLevel(current - 1));
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      setContainerWidth(element.clientWidth);
      setContainerHeight(element.clientHeight);
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const updateDpr = () => setDevicePixelRatio(window.devicePixelRatio || 1);
    updateDpr();
    window.addEventListener("resize", updateDpr, { passive: true });
    return () => window.removeEventListener("resize", updateDpr);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      pinchRef.current = {
        distance: getTouchDistance(event.touches),
        level: zoomLevel,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchRef.current) return;
      event.preventDefault();

      const distance = getTouchDistance(event.touches);
      const scale = distance / pinchRef.current.distance;

      if (scale > 1.2) {
        setZoomLevelState((current) => clampZoomLevel(current + 1));
        pinchRef.current = { distance, level: zoomLevel };
      } else if (scale < 0.83) {
        setZoomLevelState((current) => clampZoomLevel(current - 1));
        pinchRef.current = { distance, level: zoomLevel };
      }
    };

    const onTouchEnd = () => {
      pinchRef.current = null;
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (event.deltaY < 0) {
        setZoomLevelState((current) => clampZoomLevel(current + 1));
      } else if (event.deltaY > 0) {
        setZoomLevelState((current) => clampZoomLevel(current - 1));
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
  }, [containerRef, zoomLevel]);

  const value = useMemo(
    () => ({
      zoomLevel,
      layout,
      setZoomLevel,
      zoomIn,
      zoomOut,
    }),
    [zoomLevel, layout, setZoomLevel, zoomIn, zoomOut],
  );

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
}

export function useZoom(): ZoomContextValue {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error("useZoom must be used within ZoomProvider");
  }
  return context;
}
