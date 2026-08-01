export type WikiChangeHandlers = {
  onTreeChanged: () => void;
  onFileChanged: () => void;
};

/** Subscribes to `/api/events`; returns an unsubscribe function. */
export function subscribeToWikiChanges(handlers: WikiChangeHandlers): () => void {
  const source = new EventSource("/api/events");
  source.addEventListener("tree_changed", handlers.onTreeChanged);
  source.addEventListener("file_changed", handlers.onFileChanged);
  return () => source.close();
}
