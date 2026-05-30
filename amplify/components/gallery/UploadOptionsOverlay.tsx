"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatTakenAtLabel } from "@/lib/upload-files";

const OPEN_MS = 400;
const CLOSE_MS = 320;
const DRAG_THRESHOLD = 72;
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

  // gesture refs (NO rerenders)
  const dragStartY = useRef(0);
  const dragY = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state (minimal)
  const [y, setY] = useState(getOffscreenY);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  const transition = closing ? `transform ${CLOSE_MS}ms ${EASING}` : `transform ${OPEN_MS}ms ${EASING}`;

  // mount animation
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
      setY(0);
    });

    return () => cancelAnimationFrame(id);
  }, []);

  // lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    const sheetHeight = sheetRef.current?.offsetHeight ?? getOffscreenY();

    setClosing(true);
    setY(dragY.current || 0);

    requestAnimationFrame(() => {
      setY(sheetHeight);

      closeTimer.current = setTimeout(() => {
        onClose();
      }, CLOSE_MS);
    });
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? 0;
    dragY.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const yPos = e.touches[0]?.clientY ?? 0;
    const delta = Math.max(0, yPos - dragStartY.current);

    dragY.current = delta;
    setY(delta);
  };

  const onTouchEnd = () => {
    if (dragY.current > DRAG_THRESHOLD) {
      dismiss();
      return;
    }

    dragY.current = 0;
    setY(0);
  };

  const sinceLabel = latestTakenAt ? formatTakenAtLabel(latestTakenAt) : null;

  return (
    <div
      className="fixed inset-0 z-[60] box-border flex flex-col justify-end pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={dismiss}
        className={[
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ease-out",
          mounted ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{ transitionDuration: `${OPEN_MS}ms` }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full rounded-t-3xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
        style={{
          transform: `translateY(${y}px)`,
          transition,
        }}
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center px-4 pb-2 pt-3"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>

        <div className="px-4 pb-5">
          <h2 className="text-center text-lg font-semibold text-white">Add Photos</h2>

          <p className="mt-1 text-center text-sm text-white/50">Choose how you want to upload</p>

          <div className="mt-5 space-y-2">
            <button onClick={onSelectPhotos} className="w-full rounded-2xl bg-white/10 px-4 py-3.5 text-left active:bg-white/20">
              <div className="text-base font-medium text-white">Select Photos</div>
              <div className="mt-0.5 text-sm text-white/50">Pick images from your device</div>
            </button>

            <button
              onClick={onUploadSinceLatest}
              disabled={loadingLatest}
              className="w-full rounded-2xl bg-white/10 px-4 py-3.5 text-left active:bg-white/20 disabled:opacity-50"
            >
              <div className="text-base font-medium text-white">Upload Since Last Backup</div>

              <div className="mt-0.5 text-sm text-white/50">
                {loadingLatest ? "Checking your library…" : sinceLabel ? `After ${sinceLabel}` : "No previous uploads found"}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
