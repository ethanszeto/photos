"use client";

import { useEffect, useState, type RefObject } from "react";

const SCROLL_IDLE_MS = 120;

/** True when the scroll container has not scrolled recently. */
export function useScrollIdle(scrollRef: RefObject<HTMLElement | null>): boolean {
  const [isIdle, setIsIdle] = useState(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    let timer: ReturnType<typeof setTimeout>;

    const onScroll = () => {
      setIsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIsIdle(true), SCROLL_IDLE_MS);
    };

    element.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      element.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [scrollRef]);

  return isIdle;
}
