export type TreeNode = {
  name: string;
  path: string | null;
  kind: "dir" | "file";
  children: TreeNode[];
};

export type TreeResponse = {
  mode: "file" | "tree";
  initialPagePath: string | null;
  root: TreeNode;
  files: string[];
};

export type Heading = {
  id: string;
  text: string;
  level: number;
};

export type RenderResponse = {
  path: string;
  title: string;
  html: string;
  headings: Heading[];
};

export type WikiContext = {
  rootDir: string;
  initialPagePath: string | null;
  mode: "file" | "tree";
};
