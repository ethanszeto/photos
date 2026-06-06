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

const KEY_SIZE = "h-[84px] w-[84px]";

export function NumberPad({ onDigit, onDelete, disabled }: NumberPadProps) {
  return (
    <div className="mx-auto grid w-full max-w-[360px] grid-cols-3 gap-5 px-6">
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
              className={`flex ${KEY_SIZE} items-center justify-center rounded-full text-lg font-medium text-white/90 transition-transform active:scale-90 disabled:opacity-40`}
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
            className={`flex ${KEY_SIZE} items-center justify-center justify-self-center rounded-full bg-white/10 text-[32px] font-light text-white backdrop-blur-sm transition-all duration-150 hover:bg-white/15 active:scale-90 active:bg-white/25 disabled:opacity-40`}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
