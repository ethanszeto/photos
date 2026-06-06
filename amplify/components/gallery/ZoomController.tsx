"use client";

import {
  clampZoomLevel,
  clientPointToItemIndex,
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
  awarenessFocalItemIndex: number | null;
  clearAwarenessFocal: () => void;
  setZoomLevel: (level: ZoomLevel) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Zoom one step in, then scroll to center this item index. */
  zoomInAt: (itemIndex: number) => void;
  /** Zoom one step out, keeping this item index centered. */
  zoomOutAt: (itemIndex: number) => void;
};

const ZoomContext = createContext<ZoomContextValue | null>(null);

type ZoomProviderProps = {
  children: ReactNode;
  /** Attach pinch / ctrl+wheel handlers to this element. */
  containerRef: React.RefObject<HTMLElement | null>;
  itemCount: number;
};

/**
 * Manages Apple Photos-style zoom levels.
 * Layout metrics come from gallery-zoom-levels.json via computeGridLayout.
 */
export function ZoomProvider({ children, containerRef, itemCount }: ZoomProviderProps) {
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(getDefaultZoomLevel);
  const [containerWidth, setContainerWidth] = useState(390);
  const [containerHeight, setContainerHeight] = useState(800);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [awarenessFocalItemIndex, setAwarenessFocalItemIndex] = useState<number | null>(null);
  const pinchRef = useRef<{ distance: number; level: ZoomLevel } | null>(null);
  const itemCountRef = useRef(itemCount);
  const layoutRef = useRef<GridLayoutMetrics | null>(null);

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

  useEffect(() => {
    itemCountRef.current = itemCount;
    layoutRef.current = layout;
  }, [itemCount, layout]);

  const clearAwarenessFocal = useCallback(() => {
    setAwarenessFocalItemIndex(null);
  }, []);

  const applyAwarenessZoom = useCallback((delta: 1 | -1, focalItemIndex: number) => {
    setAwarenessFocalItemIndex(focalItemIndex);
    setZoomLevelState((current) => clampZoomLevel(current + delta));
  }, []);

  const focalFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const element = containerRef.current;
    const currentLayout = layoutRef.current;
    const count = itemCountRef.current;
    if (!element || !currentLayout || count <= 0) return 0;
    return clientPointToItemIndex(clientX, clientY, element, currentLayout, count);
  }, [containerRef]);

  const setZoomLevel = useCallback((level: ZoomLevel) => {
    setZoomLevelState(clampZoomLevel(level));
  }, []);

  const zoomIn = useCallback(() => {
    const element = containerRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      applyAwarenessZoom(1, focalFromClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
      return;
    }
    setZoomLevelState((current) => clampZoomLevel(current + 1));
  }, [applyAwarenessZoom, containerRef, focalFromClientPoint]);

  const zoomOut = useCallback(() => {
    const element = containerRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      applyAwarenessZoom(-1, focalFromClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
      return;
    }
    setZoomLevelState((current) => clampZoomLevel(current - 1));
  }, [applyAwarenessZoom, containerRef, focalFromClientPoint]);

  const zoomInAt = useCallback(
    (itemIndex: number) => {
      applyAwarenessZoom(1, itemIndex);
    },
    [applyAwarenessZoom],
  );

  const zoomOutAt = useCallback(
    (itemIndex: number) => {
      applyAwarenessZoom(-1, itemIndex);
    },
    [applyAwarenessZoom],
  );

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
          applyAwarenessZoom(1, focalIndex);
          pinchRef.current = { distance, level: next };
        }
      } else if (scale < 0.83) {
        const next = clampZoomLevel(pinchRef.current.level - 1);
        if (next !== pinchRef.current.level) {
          applyAwarenessZoom(-1, focalIndex);
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
        applyAwarenessZoom(1, focalIndex);
      } else if (event.deltaY > 0) {
        applyAwarenessZoom(-1, focalIndex);
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
  }, [applyAwarenessZoom, containerRef, focalFromClientPoint, zoomLevel]);

  const value = useMemo(
    () => ({
      zoomLevel,
      layout,
      awarenessFocalItemIndex,
      clearAwarenessFocal,
      setZoomLevel,
      zoomIn,
      zoomOut,
      zoomInAt,
      zoomOutAt,
    }),
    [
      zoomLevel,
      layout,
      awarenessFocalItemIndex,
      clearAwarenessFocal,
      setZoomLevel,
      zoomIn,
      zoomOut,
      zoomInAt,
      zoomOutAt,
    ],
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
