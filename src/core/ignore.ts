/**
 * Directories that are never part of a wiki and are expensive to walk. Watching
 * `node_modules` starves the event loop for minutes, which leaves the server
 * listening but unable to answer a single request.
 *
 * Applied by both the tree scan and the file watcher so the two agree on what
 * the wiki contains.
 */
const IGNORED_SEGMENTS = new Set(["node_modules"]);

export function isIgnoredSegment(name: string): boolean {
  return IGNORED_SEGMENTS.has(name);
}
