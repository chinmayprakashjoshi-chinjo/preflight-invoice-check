import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/new-invoice" });
  },
  head: () => ({
    meta: [
      { title: "PreFlight" },
      { name: "description", content: "Check invoices against client AP rules before sending." },
      { property: "og:title", content: "PreFlight" },
      {
        property: "og:description",
        content: "Check invoices against client AP rules before sending.",
      },
    ],
  }),
});
