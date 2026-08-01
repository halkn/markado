import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Heading } from "../../../src/types.ts";
import { Outline } from "../../../src/web/app/components/Outline.tsx";

const headings: Heading[] = [
  { id: "overview", text: "Overview", level: 1 },
  { id: "components", text: "Components", level: 2 },
  { id: "data-flow", text: "Data flow", level: 3 },
];

describe("Outline", () => {
  test("indents by heading level", () => {
    render(<Outline headings={headings} activeId={null} onSelect={() => {}} />);

    expect(screen.getByText("Overview").style.paddingLeft).toBe("8px");
    expect(screen.getByText("Components").style.paddingLeft).toBe("20px");
    expect(screen.getByText("Data flow").style.paddingLeft).toBe("32px");
  });

  test("marks the active heading", () => {
    render(<Outline headings={headings} activeId="components" onSelect={() => {}} />);

    expect(screen.getByText("Components").getAttribute("aria-current")).toBe("location");
    expect(screen.getByText("Overview").getAttribute("aria-current")).toBeNull();
  });

  test("reports the selected heading instead of letting the browser jump", () => {
    const onSelect = mock();
    render(<Outline headings={headings} activeId={null} onSelect={onSelect} />);

    const link = screen.getByText("Data flow");
    expect(link.getAttribute("href")).toBe("#data-flow");
    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledWith("data-flow");
  });

  test("says so when the page has no headings", () => {
    render(<Outline headings={[]} activeId={null} onSelect={() => {}} />);
    expect(screen.getByText("見出しがありません")).toBeTruthy();
  });
});
