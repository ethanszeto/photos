"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Column counts per zoom level — level 1 is most zoomed out (smallest tiles). */
export const ZOOM_COLUMN_COUNTS = [12, 8, 5, 3, 2] as const;

export type ZoomLevel = 1 | 2 | 3 | 4 | 5;

type ZoomContextValue = {
  zoomLevel: ZoomLevel;
  columns: number;
  useMediumThumbnail: boolean;
  setZoomLevel: (level: ZoomLevel) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

const ZoomContext = createContext<ZoomContextValue | null>(null);

function clampZoomLevel(level: number): ZoomLevel {
  return Math.min(5, Math.max(1, Math.round(level))) as ZoomLevel;
}

type ZoomProviderProps = {
  children: ReactNode;
  /** Attach pinch / ctrl+wheel handlers to this element. */
  containerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Manages Apple Photos-style zoom levels.
 * Levels 1-2 load smallUrl thumbnails; levels 3-5 load mediumUrl.
 */
export function ZoomProvider({ children, containerRef }: ZoomProviderProps) {
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(3);
  const pinchRef = useRef<{ distance: number; level: ZoomLevel } | null>(null);

  const columns = ZOOM_COLUMN_COUNTS[zoomLevel - 1];
  const useMediumThumbnail = zoomLevel >= 3;

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
      columns,
      useMediumThumbnail,
      setZoomLevel,
      zoomIn,
      zoomOut,
    }),
    [zoomLevel, columns, useMediumThumbnail, setZoomLevel, zoomIn, zoomOut],
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

/** Level 5 uses 1 column on narrow phones, 2 columns otherwise. */
export function useResponsiveColumns(baseColumns: number): number {
  const [width, setWidth] = useState(390);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  if (baseColumns === 2 && width < 420) {
    return 1;
  }
  return baseColumns;
}
