import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell.tsx";

/**
 * The shell lives on the root route and reads the page path from the matched
 * params, so switching pages never remounts the panes. The leaf routes exist
 * only to define which URLs are pages; they render nothing themselves.
 */
const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => null,
});

const readRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/read/$",
  component: () => null,
});

export const routeTree = rootRoute.addChildren([indexRoute, readRoute]);

/** `history` is supplied by tests, which run without a real address bar. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: false });
}

export const router = createAppRouter();
