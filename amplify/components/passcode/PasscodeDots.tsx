"use client";

type PasscodeDotsProps = {
  length: number;
  filled: number;
  shake?: boolean;
};

export function PasscodeDots({ length, filled, shake }: PasscodeDotsProps) {
  return (
    <div
      className={`flex items-center justify-center gap-3 ${shake ? "animate-shake" : ""}`}
      aria-label={`${filled} of ${length} digits entered`}
    >
      {Array.from({ length }).map((_, index) => (
        <span
          key={index}
          className={`h-3 w-3 rounded-full border transition-all duration-200 ${
            index < filled ? "scale-110 border-white bg-white" : "border-white/50 bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}
