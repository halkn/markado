import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RenderResponse } from "../../../src/types.ts";
import { DocumentView } from "../../../src/web/app/components/DocumentView.tsx";

function page(html: string): RenderResponse {
  return { path: "Home.md", title: "Home", html, headings: [] };
}

const links = page(
  [
    '<a href="/read/Guide/Next.md#Part" data-mdiv-kind="page" data-mdiv-path="Guide/Next.md" data-mdiv-anchor="Part">Next</a>',
    '<a href="https://example.com">External</a>',
    '<a href="#intro" data-mdiv-kind="anchor" data-mdiv-anchor="intro">Intro</a>',
  ].join("\n"),
);

describe("DocumentView", () => {
  test("renders the HTML the server produced", () => {
    render(<DocumentView document={page("<h1>Home</h1>")} onNavigate={() => {}} />);
    expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy();
  });

  test("routes internal page links through the app", () => {
    const onNavigate = mock();
    render(<DocumentView document={links} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Next"));
    expect(onNavigate).toHaveBeenCalledWith("Guide/Next.md", "Part");
  });

  test("leaves external links and in-page anchors to the browser", () => {
    const onNavigate = mock();
    render(<DocumentView document={links} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("External"));
    fireEvent.click(screen.getByText("Intro"));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  test("does not hijack a modified click, so open-in-new-tab still works", () => {
    const onNavigate = mock();
    render(<DocumentView document={links} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Next"), { metaKey: true });
    fireEvent.click(screen.getByText("Next"), { ctrlKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
