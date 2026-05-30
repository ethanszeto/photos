"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatTakenAtLabel } from "@/lib/upload-files";

const OPEN_ANIMATION_MS = 400;
const CLOSE_ANIMATION_MS = 320;
const DISMISS_DRAG_THRESHOLD_PX = 72;
const SHEET_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

function getOffscreenY(): number {
  if (typeof window === "undefined") return 800;
  return window.innerHeight;
}

type UploadOptionsOverlayProps = {
  latestTakenAt: string | null;
  loadingLatest: boolean;
  onSelectPhotos: () => void;
  onUploadSinceLatest: () => void;
  onClose: () => void;
};

export function UploadOptionsOverlay({
  latestTakenAt,
  loadingLatest,
  onSelectPhotos,
  onUploadSinceLatest,
  onClose,
}: UploadOptionsOverlayProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragYRef = useRef(0);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartY = useRef(0);

  const [translateY, setTranslateY] = useState(getOffscreenY);
  const [backdropVisible, setBackdropVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);

  const openTransition = `transform ${OPEN_ANIMATION_MS}ms ${SHEET_EASING}`;
  const closeTransition = `transform ${CLOSE_ANIMATION_MS}ms ${SHEET_EASING}`;

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Slide up on every mount (overlay remounts each time the FAB opens).
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMotionEnabled(true);
        setBackdropVisible(true);
        setTranslateY(0);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const slideTo = useCallback((targetY: number, durationMs: number, onDone?: () => void) => {
    setTranslateY(targetY);

    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      onDone?.();
    }, durationMs);
  }, []);

  const closeSheet = useCallback(
    (fromY: number) => {
      const sheetHeight = sheetRef.current?.offsetHeight ?? getOffscreenY();
      setIsClosing(true);
      setIsDragging(false);
      dragYRef.current = fromY;
      setTranslateY(fromY);
      setMotionEnabled(true);

      requestAnimationFrame(() => {
        setBackdropVisible(false);
        slideTo(sheetHeight, CLOSE_ANIMATION_MS, () => {
          onClose();
        });
      });
    },
    [onClose, slideTo],
  );

  const dismiss = useCallback(() => {
    closeSheet(dragYRef.current);
  }, [closeSheet]);

  const handleDragHandleTouchStart = (event: React.TouchEvent) => {
    if (exitTimerRef.current) return;
    setIsDragging(true);
    setMotionEnabled(false);
    dragStartY.current = event.touches[0]?.clientY ?? 0;
    dragYRef.current = 0;
    setTranslateY(0);
  };

  const handleDragHandleTouchMove = (event: React.TouchEvent) => {
    if (!isDragging) return;
    event.preventDefault();
    const y = event.touches[0]?.clientY ?? 0;
    const delta = Math.max(0, y - dragStartY.current);
    dragYRef.current = delta;
    setTranslateY(delta);
  };

  const endDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const y = dragYRef.current;

    if (y >= DISMISS_DRAG_THRESHOLD_PX) {
      closeSheet(y);
      return;
    }

    setMotionEnabled(true);
    dragYRef.current = 0;
    setTranslateY(0);
  };

  const sinceLabel = latestTakenAt ? formatTakenAtLabel(latestTakenAt) : null;
  const resolvedTransition = isDragging ? "none" : motionEnabled ? (isClosing ? closeTransition : openTransition) : "none";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Upload options">
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ease-out ${
          backdropVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${OPEN_ANIMATION_MS}ms` }}
        aria-label="Close upload menu"
        onClick={dismiss}
      />

      <div
        ref={sheetRef}
        className="relative z-10 w-full rounded-t-3xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: resolvedTransition,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex cursor-grab flex-col items-center px-4 pb-2 pt-3 active:cursor-grabbing"
          onTouchStart={handleDragHandleTouchStart}
          onTouchMove={handleDragHandleTouchMove}
          onTouchEnd={endDrag}
          onTouchCancel={endDrag}
          aria-label="Drag down to close"
        >
          <div className="h-1 w-10 rounded-full bg-white/30" aria-hidden />
        </div>

        <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <h2 className="text-center text-lg font-semibold text-white">Add Photos</h2>
          <p className="mt-1 text-center text-sm text-white/50">Choose how you want to upload</p>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={onSelectPhotos}
              className="flex w-full flex-col items-start rounded-2xl bg-white/10 px-4 py-3.5 text-left transition-colors active:bg-white/20"
            >
              <span className="text-base font-medium text-white">Select Photos</span>
              <span className="mt-0.5 text-sm text-white/50">Pick one or more images from your device</span>
            </button>

            <button
              type="button"
              onClick={onUploadSinceLatest}
              disabled={loadingLatest}
              className="flex w-full flex-col items-start rounded-2xl bg-white/10 px-4 py-3.5 text-left transition-colors active:bg-white/20 disabled:opacity-50"
            >
              <span className="text-base font-medium text-white">Upload New Since Last Backup</span>
              <span className="mt-0.5 text-sm text-white/50">
                {loadingLatest
                  ? "Checking your library…"
                  : sinceLabel
                    ? `Select photos taken after ${sinceLabel}`
                    : "No photos in your library yet — select photos to upload"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
