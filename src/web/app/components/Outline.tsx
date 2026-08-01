import type { JSX } from "react";
import type { Heading } from "../../../types.ts";
import { cn } from "@/lib/utils.ts";

export type OutlineProps = {
  headings: Heading[];
  activeId: string | null;
  onSelect: (headingId: string) => void;
};

export function Outline({ headings, activeId, onSelect }: OutlineProps): JSX.Element {
  if (headings.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">見出しがありません</p>;
  }

  return (
    <nav aria-label="On this page" className="p-2 text-sm">
      <ul className="list-none">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${encodeURIComponent(heading.id)}`}
              aria-current={heading.id === activeId ? "location" : undefined}
              className={cn(
                "block truncate rounded-md px-2 py-1",
                heading.id === activeId ? "bg-brand-soft text-brand" : "hover:bg-accent",
              )}
              style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
              onClick={(event) => {
                event.preventDefault();
                onSelect(heading.id);
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
