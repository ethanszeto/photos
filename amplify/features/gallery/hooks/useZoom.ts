"use client";

import { createContext, useContext } from "react";
import type { AwarenessFocal, GridLayoutMetrics, ZoomLevel } from "@/features/gallery/lib/grid-layout";

export type ZoomContextValue = {
  zoomLevel: ZoomLevel;
  layout: GridLayoutMetrics;
  awarenessFocal: AwarenessFocal | null;
  clearAwarenessFocal: () => void;
  setZoomLevel: (level: ZoomLevel) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomInAt: (itemIndex: number) => void;
  zoomOutAt: (itemIndex: number) => void;
};

export const ZoomContext = createContext<ZoomContextValue | null>(null);

export function useZoom(): ZoomContextValue {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error("useZoom must be used within ZoomProvider");
  }
  return context;
}
