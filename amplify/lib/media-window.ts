import { DEFAULT_PAGE_SIZE, MAX_LOADED_ITEMS } from "@/lib/media-constants";
import type { MediaItem } from "@/types";

export type TrimLoadedItemsResult = {
  items: MediaItem[];
  /** How many items were removed from the start of the array. */
  removedFromStart: number;
};

/**
 * Cap in-memory catalog size by dropping pages farthest from the scroll anchor.
 * Newest-first ordering: index 0 is newest, high indices are older loaded pages.
 */
export function trimLoadedItems(items: MediaItem[], anchorIndex: number): TrimLoadedItemsResult {
  if (items.length <= MAX_LOADED_ITEMS) {
    return { items, removedFromStart: 0 };
  }

  const excess = items.length - MAX_LOADED_ITEMS;
  const trimCount = Math.min(
    items.length,
    Math.max(DEFAULT_PAGE_SIZE, Math.ceil(excess / DEFAULT_PAGE_SIZE) * DEFAULT_PAGE_SIZE),
  );

  // Viewing newer portion — drop oldest loaded slice from the end.
  if (anchorIndex < items.length * 0.4) {
    return { items: items.slice(0, items.length - trimCount), removedFromStart: 0 };
  }

  // Deep in archive — drop newest slice from the start.
  return { items: items.slice(trimCount), removedFromStart: trimCount };
}
