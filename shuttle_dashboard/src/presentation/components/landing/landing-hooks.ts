"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Marks every `[data-reveal]` descendant with `data-in` the first time it scrolls into view.
 * A data attribute (not a class) so React re-rendering `className` cannot wipe it.
 */
export function useReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>("[data-reveal]");

    if (reducedMotion()) {
      targets.forEach((target) => target.setAttribute("data-in", ""));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          observer.unobserve(entry.target);
        }
      },
      { root, rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [rootRef]);
}

/**
 * Drives scroll-linked effects on the landing scroller: the scrolled flag and
 * `--p` on `[data-scroll-progress]` sections near the viewport.
 * Reads all layout first, then writes, so a frame never forces a second layout.
 */
export function useScrollEffects(rootRef: RefObject<HTMLElement | null>) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const tracked = [...root.querySelectorAll<HTMLElement>("[data-scroll-progress]")];
    const lastProgress = new Map<HTMLElement, string>();
    let lastScrolled = false;
    let frame = 0;

    function update() {
      frame = 0;
      const el = root!;
      const scrollTop = el.scrollTop;
      const viewport = el.clientHeight;
      const rects = tracked.map((section) => section.getBoundingClientRect());

      const isScrolled = scrollTop > 24;
      if (isScrolled !== lastScrolled) {
        lastScrolled = isScrolled;
        setScrolled(isScrolled);
      }

      tracked.forEach((section, index) => {
        const rect = rects[index]!;
        if (rect.bottom < -viewport * 0.5 || rect.top > viewport * 1.5) return;
        const progress = clamp((viewport * 0.62 - rect.top) / rect.height).toFixed(3);
        if (lastProgress.get(section) === progress) return;
        lastProgress.set(section, progress);
        section.style.setProperty("--p", progress);
      });
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [rootRef]);

  return scrolled;
}

/**
 * Sets `data-idle` on `selector` blocks that are off-screen so CSS can pause their
 * animations, and pauses their SVG (SMIL) animations, which CSS cannot reach.
 */
export function useIdleZones(rootRef: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const zones = root.querySelectorAll<HTMLElement>(selector);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const zone = entry.target as HTMLElement;
          const idle = !entry.isIntersecting;
          zone.toggleAttribute("data-idle", idle);
          zone.querySelectorAll("svg").forEach((svg) => {
            if (idle) svg.pauseAnimations();
            else svg.unpauseAnimations();
          });
        }
      },
      { root, rootMargin: "200px 0px" },
    );
    zones.forEach((zone) => observer.observe(zone));
    return () => observer.disconnect();
  }, [rootRef, selector]);
}

/** Tracks which `section[id]` is currently in the middle of the scroller. */
export function useActiveSection(rootRef: RefObject<HTMLElement | null>, ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { root, rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const section = root.querySelector(`#${id}`);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [rootRef, ids]);

  return active;
}

export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

export function useCountUp(target: number, active: boolean, duration = 1800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion()) {
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    const start = performance.now();

    function tick(now: number) {
      const t = clamp((now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return value;
}

/** Cycles through `count` items every `interval` ms, pausing while the page is hidden. */
export function useCycle(count: number, interval: number, paused = false) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % count);
    }, interval);
    return () => window.clearInterval(id);
  }, [count, interval, paused]);

  return [index, setIndex] as const;
}

/**
 * Listens for pointer moves on the element and writes `--mx`/`--my` (element space) onto the
 * `target` descendant only, so a move restyles one layer instead of the whole subtree.
 */
export function usePointerVars<T extends HTMLElement>(target: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !window.matchMedia("(pointer: fine)").matches) return;
    const layer = element.querySelector<HTMLElement>(target);
    if (!layer) return;
    let frame = 0;

    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element!.getBoundingClientRect();
        layer!.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        layer!.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    }

    element.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
    };
  }, [target]);

  return ref;
}

/** Lights up `[data-glow]` children with a cursor-following halo (`--gx`/`--gy`). */
export function useGlowCards<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || !window.matchMedia("(pointer: fine)").matches) return;
    const cards = container.querySelectorAll<HTMLElement>("[data-glow]");
    let frame = 0;

    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty("--gx", `${event.clientX - rect.left}px`);
          card.style.setProperty("--gy", `${event.clientY - rect.top}px`);
        });
      });
    }

    container.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("pointermove", onMove);
    };
  }, []);

  return ref;
}

/** 3D tilt toward the pointer via `--rx`/`--ry`. */
export function useTilt<T extends HTMLElement>(strength = 8) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (reducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;

    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element!.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        element!.classList.add("is-tilting");
        element!.style.setProperty("--rx", `${((0.5 - py) * strength).toFixed(2)}deg`);
        element!.style.setProperty("--ry", `${((px - 0.5) * strength * 1.3).toFixed(2)}deg`);
      });
    }

    function onLeave() {
      cancelAnimationFrame(frame);
      element!.classList.remove("is-tilting");
      element!.style.setProperty("--rx", "0deg");
      element!.style.setProperty("--ry", "0deg");
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);

  return ref;
}

/** Pulls the element slightly toward the pointer while hovered. */
export function useMagnetic<T extends HTMLElement>(strength = 0.28) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (reducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;

    function onMove(event: PointerEvent) {
      const rect = element!.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      element!.style.translate = `${(dx * strength).toFixed(1)}px ${(dy * strength).toFixed(1)}px`;
    }

    function onLeave() {
      element!.style.translate = "";
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);

  return ref;
}
