import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TreeNode } from "../../../src/types.ts";
import { FileTree } from "../../../src/web/app/components/FileTree.tsx";

function dir(name: string, children: TreeNode[]): TreeNode {
  return { name, path: null, kind: "dir", children };
}

function file(name: string, path: string, children: TreeNode[] = []): TreeNode {
  return { name, path, kind: "file", children };
}

const root = dir("wiki", [
  file("Home", "Home.md"),
  dir("docs", [file("architecture", "docs/architecture.md")]),
  file("Guide", "Guide.md", [file("Install", "Guide/Install.md")]),
]);

describe("FileTree", () => {
  test("hides the contents of a directory until it is opened", () => {
    render(<FileTree root={root} currentPath="Home.md" onNavigate={() => {}} />);

    expect(screen.queryByText("architecture")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "docs を開く" }));
    expect(screen.getByText("architecture")).toBeTruthy();
  });

  test("opens the ancestors of the current page", () => {
    render(<FileTree root={root} currentPath="docs/architecture.md" onNavigate={() => {}} />);

    expect(screen.getByText("architecture")).toBeTruthy();
  });

  test("marks the current page and only the current page", () => {
    render(<FileTree root={root} currentPath="Home.md" onNavigate={() => {}} />);

    const current = screen
      .getAllByRole("treeitem")
      .filter((item) => item.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain("Home");
  });

  test("reports the page path when a file is chosen", () => {
    const onNavigate = mock();
    render(<FileTree root={root} currentPath={null} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Home"));
    expect(onNavigate).toHaveBeenCalledWith("Home.md");
  });

  test("an Azure DevOps page folder is both a link and a parent", () => {
    const onNavigate = mock();
    render(<FileTree root={root} currentPath={null} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Guide"));
    expect(onNavigate).toHaveBeenCalledWith("Guide.md");

    fireEvent.click(screen.getByRole("button", { name: "Guide を開く" }));
    expect(screen.getByText("Install")).toBeTruthy();
  });
});
