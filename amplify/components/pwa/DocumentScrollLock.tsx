"use client";

import { useEffect } from "react";

/** Regions that may handle their own touch scrolling or drag gestures. */
const SCROLL_ALLOW_SELECTOR = "[data-gallery-scroll], [data-media-viewer], [data-upload-sheet]";

/**
 * iOS PWA: block document rubber-banding; only the gallery grid (and viewer/sheet) may scroll.
 */
export function DocumentScrollLock() {
  useEffect(() => {
    const onTouchMove = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(SCROLL_ALLOW_SELECTOR)) return;
      event.preventDefault();
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => document.removeEventListener("touchmove", onTouchMove);
  }, []);

  return null;
}
