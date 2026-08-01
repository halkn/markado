import { ChevronRight } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { TreeNode } from "../../../types.ts";
import { childKey, expandedKeysFor } from "@/lib/tree.ts";
import { cn } from "@/lib/utils.ts";

export type FileTreeProps = {
  root: TreeNode;
  currentPath: string | null;
  onNavigate: (pagePath: string) => void;
};

export function FileTree({ root, currentPath, onNavigate }: FileTreeProps): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(() => expandedKeysFor(root, currentPath));

  // Reveal the current page when navigation happens elsewhere, e.g. through a
  // link in the document, without collapsing what the reader opened by hand.
  useEffect(() => {
    setExpanded((current) => new Set([...current, ...expandedKeysFor(root, currentPath)]));
  }, [root, currentPath]);

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });

  return (
    <nav aria-label="Files" className="p-2 text-sm">
      <ul role="tree" className="list-none">
        {root.children.map((node) => (
          <TreeItem
            key={childKey("", node)}
            node={node}
            parentKey=""
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}

type TreeItemProps = {
  node: TreeNode;
  parentKey: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  currentPath: string | null;
  onNavigate: (pagePath: string) => void;
};

function TreeItem(props: TreeItemProps): JSX.Element {
  const { node, parentKey, depth, expanded, onToggle, currentPath, onNavigate } = props;
  const key = childKey(parentKey, node);
  const pagePath = node.path;
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(key);
  const isCurrent = pagePath !== null && pagePath === currentPath;

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-current={isCurrent ? "page" : undefined}
        aria-selected={isCurrent}
        className={cn(
          "flex items-center gap-0.5 rounded-md pr-1",
          isCurrent ? "bg-brand-soft text-brand" : "hover:bg-accent",
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? `${node.name} を閉じる` : `${node.name} を開く`}
            className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground"
            onClick={() => onToggle(key)}
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
              aria-hidden
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden />
        )}

        {pagePath === null ? (
          <button
            type="button"
            className="min-w-0 flex-1 truncate py-1 text-left text-muted-foreground"
            onClick={() => onToggle(key)}
          >
            {node.name}
          </button>
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate py-1 text-left"
            onClick={() => onNavigate(pagePath)}
          >
            {node.name}
          </button>
        )}
      </div>

      {hasChildren && isOpen && (
        <ul role="group" className="list-none">
          {node.children.map((child) => (
            <TreeItem
              key={childKey(key, child)}
              node={child}
              parentKey={key}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
