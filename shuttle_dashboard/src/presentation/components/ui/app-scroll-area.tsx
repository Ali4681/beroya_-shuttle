"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type AppScrollAreaProps = {
  children: ReactNode;
  className?: string;
  fade?: boolean;
  as?: "div" | "nav" | "main";
};

export function AppScrollArea({
  children,
  className,
  fade = false,
  as = "div",
}: AppScrollAreaProps) {
  const ref = useRef<HTMLElement>(null);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    function onScroll() {
      setScrolling(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 700);
    }

    node.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      node.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const Component = as;

  return (
    <Component
      ref={ref as never}
      className={cn(
        "app-scroll overflow-y-auto overscroll-contain",
        fade && "app-scroll-fade",
        scrolling && "is-scrolling",
        className,
      )}
    >
      {children}
    </Component>
  );
}
