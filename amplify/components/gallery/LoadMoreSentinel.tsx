"use client";

import { useEffect, useRef, type RefObject } from "react";

const LOAD_MORE_ROOT_MARGIN = "800px 0px";
const LOAD_MORE_ROOT_MARGIN_PX = 800;

type LoadMoreSentinelProps = {
  scrollRootRef: RefObject<HTMLElement | null>;
  onLoadMore: () => void;
  hasMore: boolean;
  /** Re-check when the list grows — IO won't re-fire if the sentinel never left view. */
  itemCount: number;
};

function isNearScrollEnd(root: HTMLElement, node: HTMLElement): boolean {
  const rootRect = root.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  return nodeRect.top <= rootRect.bottom + LOAD_MORE_ROOT_MARGIN_PX;
}

/** Triggers pagination when the user nears the end of the virtualized list. */
export function LoadMoreSentinel({ scrollRootRef, onLoadMore, hasMore, itemCount }: LoadMoreSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!node || !root) return;

    const maybeLoad = () => {
      if (isNearScrollEnd(root, node)) {
        onLoadMoreRef.current();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { root, rootMargin: LOAD_MORE_ROOT_MARGIN },
    );

    observer.observe(node);
    maybeLoad();

    const onScroll = () => {
      maybeLoad();
    };

    root.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, [hasMore, scrollRootRef, itemCount]);

  if (!hasMore) return null;

  return <div ref={sentinelRef} className="h-20" aria-hidden />;
}
