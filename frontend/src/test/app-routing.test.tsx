import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches a page for /app/new-invoice", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/app/new-invoice");

    expect(matches.at(-1)?.routeId).toBe("/app/new-invoice");
  });

  it("matches a page for other app routes", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/app/clients").at(-1)?.routeId).toBe("/app/clients");
    expect(router.matchRoutes("/app/pricer").at(-1)?.routeId).toBe("/app/pricer");
    expect(router.matchRoutes("/app/invoices").at(-1)?.routeId).toBe("/app/invoices");
  });
});
