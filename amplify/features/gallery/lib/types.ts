import type { Virtualizer } from "@tanstack/react-virtual";

export type GalleryVirtualizerHandle = {
  scrollToItemIndex: (index: number, options?: { align?: "start" | "center"; behavior?: ScrollBehavior }) => void;
  getFirstVisibleItemIndex: () => number;
  getCenterItemIndex: () => number;
  getVirtualizer: () => Virtualizer<HTMLDivElement, Element> | null;
};
