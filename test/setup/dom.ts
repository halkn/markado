import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

/**
 * Preloaded for `test/web` only. Registering happy-dom globally replaces
 * `Response`, and the server routes hand a `BunFile` to it, so the server tests
 * have to keep running in a process without a DOM.
 */
GlobalRegistrator.register({ url: "http://localhost/" });

// Testing Library only auto-cleans when it can see a global `afterEach`, which
// bun:test does not provide; without this, renders from one file are still in
// the document while the next file queries it.
const { cleanup } = await import("@testing-library/react");
afterEach(cleanup);

/** happy-dom has no `EventSource`; live reload is exercised by the server tests. */
class InertEventSource {
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

globalThis.EventSource ??= InertEventSource as unknown as typeof EventSource;
