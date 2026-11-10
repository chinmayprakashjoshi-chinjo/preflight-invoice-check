import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/landing/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PreFlight: check the invoice before you send it" },
      {
        name: "description",
        content:
          "PreFlight reads your client's AP rules, flags what would get your invoice rejected, then sends it through PayPal.",
      },
    ],
  }),
  component: Landing,
});
