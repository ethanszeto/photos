"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type VisibilityCallback = (visible: boolean) => void;

type GridImageVisibilityContextValue = {
  observe: (element: Element, onVisible: VisibilityCallback) => () => void;
  isScrollIdle: boolean;
};

const GridImageVisibilityContext = createContext<GridImageVisibilityContextValue | null>(null);

type GridImageVisibilityProviderProps = {
  scrollRef: RefObject<HTMLElement | null>;
  rootMargin: string;
  /** When true, defer new image loads until scroll settles (mega-wide grid). */
  gateLoadsWhileScrolling?: boolean;
  children: ReactNode;
};

const SCROLL_IDLE_MS = 120;

export function GridImageVisibilityProvider({
  scrollRef,
  rootMargin,
  gateLoadsWhileScrolling = false,
  children,
}: GridImageVisibilityProviderProps) {
  const callbacksRef = useRef(new Map<Element, VisibilityCallback>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isScrollIdle, setIsScrollIdle] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const observe = useCallback((element: Element, onVisible: VisibilityCallback) => {
    callbacksRef.current.set(element, onVisible);
    observerRef.current?.observe(element);
    return () => {
      callbacksRef.current.delete(element);
      observerRef.current?.unobserve(element);
    };
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          callbacksRef.current.get(entry.target)?.(entry.isIntersecting);
        }
      },
      { root, rootMargin, threshold: 0 },
    );

    observerRef.current = observer;
    for (const element of callbacksRef.current.keys()) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [scrollRef, rootMargin]);

  useEffect(() => {
    if (!gateLoadsWhileScrolling) return;
    const root = scrollRef.current;
    if (!root) return;

    const markScrolling = () => {
      setIsScrollIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsScrollIdle(true);
      }, SCROLL_IDLE_MS);
    };

    root.addEventListener("scroll", markScrolling, { passive: true });
    return () => {
      root.removeEventListener("scroll", markScrolling);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [gateLoadsWhileScrolling, scrollRef]);

  const value = useMemo(() => ({ observe, isScrollIdle }), [observe, isScrollIdle]);

  return <GridImageVisibilityContext.Provider value={value}>{children}</GridImageVisibilityContext.Provider>;
}

export function useGridImageVisibility(): GridImageVisibilityContextValue {
  const context = useContext(GridImageVisibilityContext);
  if (!context) {
    throw new Error("useGridImageVisibility must be used within GridImageVisibilityProvider");
  }
  return context;
}
