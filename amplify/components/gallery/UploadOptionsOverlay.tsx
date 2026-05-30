"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatTakenAtLabel } from "@/lib/upload-files";

const OPEN_MS = 400;
const CLOSE_MS = 400;
const DRAG_THRESHOLD = 72;
const VELOCITY_DISMISS = 1.2;
const EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

function getOffscreenY() {
  if (typeof window === "undefined") return 800;
  return window.innerHeight;
}

type Props = {
  latestTakenAt: string | null;
  loadingLatest: boolean;
  onSelectPhotos: () => void;
  onUploadSinceLatest: () => void;
  onClose: () => void;
};

export function UploadOptionsOverlay({ latestTakenAt, loadingLatest, onSelectPhotos, onUploadSinceLatest, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragStartY = useRef(0);
  const dragDistance = useRef(0);

  const lastMoveY = useRef(0);
  const lastMoveTime = useRef(0);
  const velocityY = useRef(0);

  const dragging = useRef(false);

  const [mounted, setMounted] = useState(false);

  const applyTransform = useCallback((translateY: number) => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;

    if (!sheet) return;

    sheet.style.transform = `translateY(${translateY}px)`;

    if (backdrop) {
      const opacity = Math.max(0, 1 - translateY / 300);
      backdrop.style.opacity = opacity.toString();
    }
  }, []);

  const enableTransition = useCallback((duration: number) => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;

    if (sheet) {
      sheet.style.transition = `transform ${duration}ms ${EASING}`;
    }

    if (backdrop) {
      backdrop.style.transition = `opacity ${duration}ms ease`;
    }
  }, []);

  const disableTransition = useCallback(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;

    if (sheet) {
      sheet.style.transition = "none";
    }

    if (backdrop) {
      backdrop.style.transition = "none";
    }
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      enableTransition(OPEN_MS);
      applyTransform(0);
      setMounted(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [applyTransform, enableTransition]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;

      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    };
  }, []);

  const dismiss = useCallback(() => {
    const sheetHeight = sheetRef.current?.offsetHeight ?? getOffscreenY();

    enableTransition(CLOSE_MS);

    requestAnimationFrame(() => {
      applyTransform(sheetHeight);

      closeTimer.current = setTimeout(() => {
        onClose();
      }, CLOSE_MS);
    });
  }, [applyTransform, enableTransition, onClose]);

  const snapBack = useCallback(() => {
    enableTransition(OPEN_MS);
    applyTransform(0);
  }, [applyTransform, enableTransition]);

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;

    disableTransition();

    dragStartY.current = e.touches[0]?.clientY ?? 0;
    dragDistance.current = 0;

    lastMoveY.current = dragStartY.current;
    lastMoveTime.current = performance.now();
    velocityY.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;

    const y = e.touches[0]?.clientY ?? 0;

    const rawDelta = Math.max(0, y - dragStartY.current);

    const delta = rawDelta < 120 ? rawDelta : 120 + (rawDelta - 120) * 0.35;

    const now = performance.now();

    velocityY.current = (y - lastMoveY.current) / Math.max(1, now - lastMoveTime.current);

    lastMoveY.current = y;
    lastMoveTime.current = now;

    dragDistance.current = delta;

    applyTransform(delta);
  };

  const onTouchEnd = () => {
    if (!dragging.current) return;

    dragging.current = false;

    const shouldDismiss = dragDistance.current > DRAG_THRESHOLD || velocityY.current > VELOCITY_DISMISS;

    if (shouldDismiss) {
      dismiss();
      return;
    }

    snapBack();
  };

  const sinceLabel = latestTakenAt ? formatTakenAtLabel(latestTakenAt) : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" data-upload-sheet role="dialog" aria-modal="true">
      <button
        ref={backdropRef}
        type="button"
        onClick={dismiss}
        aria-label="Close upload menu"
        className={["absolute inset-0 bg-black/60 backdrop-blur-sm", mounted ? "opacity-100" : "opacity-0"].join(" ")}
      />

      <div
        ref={sheetRef}
        className="relative z-10 w-full rounded-3xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
        style={{
          transform: `translateY(${getOffscreenY()}px)`,
          willChange: "transform",
        }}
      >
        <div
          className="flex flex-col items-center px-4 pb-2 pt-3"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
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

              <span className="mt-0.5 text-sm text-white/50">Pick images from your device</span>
            </button>

            <button
              type="button"
              onClick={onUploadSinceLatest}
              disabled={loadingLatest}
              className="flex w-full flex-col items-start rounded-2xl bg-white/10 px-4 py-3.5 text-left transition-colors active:bg-white/20 disabled:opacity-50"
            >
              <span className="text-base font-medium text-white">Upload Since Last Backup</span>

              <span className="mt-0.5 text-sm text-white/50">
                {loadingLatest ? "Checking your library…" : sinceLabel ? `After ${sinceLabel}` : "No previous uploads found"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
