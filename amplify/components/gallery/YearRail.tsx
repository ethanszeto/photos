"use client";

import { memo, useMemo } from "react";

type YearRailProps = {
  years: number[];
  activeYear: number | null;
  onYearSelect: (year: number) => void;
};

/**
 * Fixed vertical year scrubber — generated from loaded media only.
 * Stays visible while the grid scrolls underneath.
 */
export const YearRail = memo(function YearRail({ years, activeYear, onYearSelect }: YearRailProps) {
  const displayYears = useMemo(() => [...years].sort((a, b) => b - a), [years]);

  if (displayYears.length === 0) return null;

  return (
    <nav
      aria-label="Jump to year"
      className="pointer-events-auto fixed left-0 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-0.5 pl-1 sm:gap-1 sm:pl-2"
    >
      {displayYears.map((year) => {
        const isActive = year === activeYear;
        return (
          <button
            key={year}
            type="button"
            onClick={() => onYearSelect(year)}
            className={`rounded px-1.5 py-0.5 text-right text-[11px] font-medium tabular-nums transition-colors duration-150 ${
              isActive ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
            }`}
            aria-current={isActive ? "true" : undefined}
          >
            {year}
          </button>
        );
      })}
    </nav>
  );
});

/** Build a map of year → first item index for scroll targeting. */
export function buildYearIndex(items: { takenAt: string }[]): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const year = new Date(items[i].takenAt).getFullYear();
    if (!map.has(year)) {
      map.set(year, i);
    }
  }
  return map;
}

/** Extract sorted unique years (descending) from loaded items. */
export function extractYears(items: { takenAt: string }[]): number[] {
  const years = new Set<number>();
  for (const item of items) {
    years.add(new Date(item.takenAt).getFullYear());
  }
  return [...years].sort((a, b) => b - a);
}

/** Resolve the active year from the first visible item index. */
export function getActiveYear(items: { takenAt: string }[], firstVisibleIndex: number): number | null {
  const item = items[firstVisibleIndex];
  if (!item) return null;
  return new Date(item.takenAt).getFullYear();
}
