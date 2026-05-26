"use client";

type NumberPadProps = {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  disabled?: boolean;
};

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "delete"],
] as const;

export function NumberPad({ onDigit, onDelete, disabled }: NumberPadProps) {
  return (
    <div className="grid w-full max-w-[320px] grid-cols-3 gap-4 px-6">
      {KEYS.flat().map((key, index) => {
        if (key === "") {
          return <div key={`spacer-${index}`} aria-hidden />;
        }

        if (key === "delete") {
          return (
            <button
              key="delete"
              type="button"
              disabled={disabled}
              onClick={onDelete}
              className="flex h-[72px] items-center justify-center rounded-full text-[17px] font-medium text-white/90 transition-transform active:scale-90 disabled:opacity-40"
              aria-label="Delete"
            >
              Delete
            </button>
          );
        }

        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(key)}
            className="flex h-[72px] w-[72px] items-center justify-center justify-self-center rounded-full bg-white/10 text-[28px] font-light text-white backdrop-blur-sm transition-all duration-150 hover:bg-white/15 active:scale-90 active:bg-white/25 disabled:opacity-40"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
