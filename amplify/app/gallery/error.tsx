"use client";

export default function GalleryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-white">
      <p className="text-center text-sm text-white/70">Something went wrong loading your gallery.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-white/10 px-5 py-2 text-sm text-white transition-colors hover:bg-white/15 active:bg-white/20"
      >
        Try again
      </button>
    </div>
  );
}
