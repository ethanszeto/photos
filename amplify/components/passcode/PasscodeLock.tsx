"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { NumberPad } from "@/components/passcode/NumberPad";
import { PasscodeDots } from "@/components/passcode/PasscodeDots";

const PASSCODE_LENGTH = 6;

type PasscodeLockProps = {
  redirectTo?: string;
};

export function PasscodeLock({ redirectTo = "/gallery" }: PasscodeLockProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setDigits([]);
    setError(null);
  }, []);

  const submitPasscode = useCallback(
    async (passcode: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        });

        if (!response.ok) {
          setShake(true);
          setError("Try Again");
          setTimeout(() => {
            setShake(false);
            reset();
          }, 450);
          return;
        }

        router.replace(redirectTo);
        router.refresh();
      } catch {
        setShake(true);
        setError("Connection error");
        setTimeout(() => {
          setShake(false);
          reset();
        }, 450);
      } finally {
        setSubmitting(false);
      }
    },
    [redirectTo, reset, router],
  );

  const handleDigit = (digit: string) => {
    if (submitting || digits.length >= PASSCODE_LENGTH) return;
    setError(null);
    const next = [...digits, digit];
    setDigits(next);
    if (next.length === PASSCODE_LENGTH) {
      void submitPasscode(next.join(""));
    }
  };

  const handleDelete = () => {
    if (submitting) return;
    setError(null);
    setDigits((current) => current.slice(0, -1));
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-black pb-10 pt-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-900/80 via-black to-black" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(80,80,120,0.25),_transparent_60%)]"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="text-center">
          <p className="text-sm font-medium tracking-wide text-white/60">Photos</p>
          <h1 className="mt-2 text-xl font-semibold text-white">Enter Passcode</h1>
        </div>
        <PasscodeDots length={PASSCODE_LENGTH} filled={digits.length} shake={shake} />
        {error && <p className="animate-fade-in text-sm font-medium text-red-400">{error}</p>}
      </div>

      <div className="relative z-10 flex w-full flex-col items-center gap-6">
        <NumberPad onDigit={handleDigit} onDelete={handleDelete} disabled={submitting} />
      </div>
    </div>
  );
}
