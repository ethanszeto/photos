"use client";

import {
  clampZoomLevel,
  clientPointToItemIndex,
  computeGridLayout,
  getDefaultZoomLevel,
  type AwarenessFocal,
  type GridLayoutMetrics,
  type ZoomLevel,
} from "@/features/gallery/lib/grid-layout";
import { useZoomGestures } from "@/features/gallery/hooks/useZoomGestures";
import { ZoomContext, type ZoomContextValue } from "@/features/gallery/hooks/useZoom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type { GridLayoutMetrics, ZoomLevel };
export { GALLERY_ZOOM_LEVELS, getDefaultZoomLevel, ZOOM_LEVEL_COUNT } from "@/features/gallery/lib/grid-layout";

type ZoomProviderProps = {
  children: ReactNode;
  containerRef: React.RefObject<HTMLElement | null>;
  transformRef: React.RefObject<HTMLElement | null>;
  itemCount: number;
};

/** Apple Photos-style zoom — layout from computeGridLayout, gestures via useZoomGestures. */
export function ZoomProvider({ children, containerRef, transformRef, itemCount }: ZoomProviderProps) {
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(getDefaultZoomLevel);
  const [containerWidth, setContainerWidth] = useState(390);
  const [containerHeight, setContainerHeight] = useState(800);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [awarenessFocal, setAwarenessFocal] = useState<AwarenessFocal | null>(null);
  const itemCountRef = useRef(itemCount);
  const layoutRef = useRef<GridLayoutMetrics | null>(null);

  const layout = useMemo(
    () =>
      computeGridLayout({
        zoomLevel,
        containerWidth,
        viewportHeight: containerHeight,
        devicePixelRatio,
        itemCount,
      }),
    [zoomLevel, containerWidth, containerHeight, devicePixelRatio, itemCount],
  );

  useEffect(() => {
    itemCountRef.current = itemCount;
    layoutRef.current = layout;
  }, [itemCount, layout]);

  const clearAwarenessFocal = useCallback(() => {
    setAwarenessFocal(null);
  }, []);

  const applyAwarenessZoom = useCallback((delta: 1 | -1, focalItemIndex: number, viewportOffsetY: number) => {
    setAwarenessFocal({ itemIndex: focalItemIndex, viewportOffsetY });
    setZoomLevelState((current) => clampZoomLevel(current + delta));
  }, []);

  const commitZoomAtFocal = useCallback((targetLevel: ZoomLevel, focalItemIndex: number, viewportOffsetY: number) => {
    const next = clampZoomLevel(targetLevel);
    setAwarenessFocal({ itemIndex: focalItemIndex, viewportOffsetY });
    setZoomLevelState(next);
  }, []);

  const focalFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const element = containerRef.current;
      const currentLayout = layoutRef.current;
      const count = itemCountRef.current;
      if (!element || !currentLayout || count <= 0) return 0;
      return clientPointToItemIndex(clientX, clientY, element, currentLayout, count);
    },
    [containerRef],
  );

  const setZoomLevel = useCallback((level: ZoomLevel) => {
    setZoomLevelState(clampZoomLevel(level));
  }, []);

  const zoomIn = useCallback(() => {
    const element = containerRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      applyAwarenessZoom(
        1,
        focalFromClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
        element.clientHeight / 2,
      );
      return;
    }
    setZoomLevelState((current) => clampZoomLevel(current + 1));
  }, [applyAwarenessZoom, containerRef, focalFromClientPoint]);

  const zoomOut = useCallback(() => {
    const element = containerRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      applyAwarenessZoom(
        -1,
        focalFromClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
        element.clientHeight / 2,
      );
      return;
    }
    setZoomLevelState((current) => clampZoomLevel(current - 1));
  }, [applyAwarenessZoom, containerRef, focalFromClientPoint]);

  const zoomInAt = useCallback(
    (itemIndex: number) => {
      const element = containerRef.current;
      applyAwarenessZoom(1, itemIndex, element ? element.clientHeight / 2 : 0);
    },
    [applyAwarenessZoom, containerRef],
  );

  const zoomOutAt = useCallback(
    (itemIndex: number) => {
      const element = containerRef.current;
      applyAwarenessZoom(-1, itemIndex, element ? element.clientHeight / 2 : 0);
    },
    [applyAwarenessZoom, containerRef],
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

  useZoomGestures({
    containerRef,
    transformRef,
    layoutRef,
    itemCountRef,
    zoomLevel,
    onCommitZoom: commitZoomAtFocal,
    onStepZoom: applyAwarenessZoom,
  });

  const value = useMemo<ZoomContextValue>(
    () => ({
      zoomLevel,
      layout,
      awarenessFocal,
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
      awarenessFocal,
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
