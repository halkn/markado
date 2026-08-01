import { useEffect, useState, type RefObject } from "react";
import type { Heading } from "../../../types.ts";

/**
 * Tracks which heading the reader is currently under. Falls back to the first
 * heading where `IntersectionObserver` is unavailable.
 */
export function useActiveHeading(
  containerRef: RefObject<HTMLElement | null>,
  headings: Heading[],
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(headings[0]?.id ?? null);

    const container = containerRef.current;
    if (!container || headings.length === 0 || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }
        const first = headings.find((heading) => visible.has(heading.id));
        if (first) {
          setActiveId(first.id);
        }
      },
      { root: container, rootMargin: "0px 0px -70% 0px" },
    );

    for (const heading of headings) {
      const element = container.querySelector(`#${CSS.escape(heading.id)}`);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [containerRef, headings]);

  return activeId;
}
