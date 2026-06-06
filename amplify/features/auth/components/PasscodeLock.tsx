"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { NumberPad } from "@/features/auth/components/NumberPad";
import { PasscodeDots } from "@/features/auth/components/PasscodeDots";

const PASSCODE_LENGTH = 6;

type PasscodeLockProps = {
  redirectTo?: string;
};

export function PasscodeLock({ redirectTo = "/photos" }: PasscodeLockProps) {
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
    <div className="content relative flex min-h-0 w-full flex-1 flex-col overflow-hidden overscroll-none bg-black">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pt-4">
        <div className="text-center">
          <p className="text-sm font-medium tracking-wide text-white/60">Photos</p>
          <h1 className="mt-2 text-xl font-semibold text-white">Enter Passcode</h1>
        </div>
        <PasscodeDots length={PASSCODE_LENGTH} filled={digits.length} shake={shake} />
        {error && <p className="animate-fade-in text-sm font-medium text-red-400">{error}</p>}
      </div>

      <div className="w-full shrink-0 pb-20">
        <NumberPad onDigit={handleDigit} onDelete={handleDelete} disabled={submitting} />
      </div>
    </div>
  );
}
