import { createFileRoute } from "@tanstack/react-router";
import { RentChat } from "@/components/rent-chat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RentResolve — Get started with your deposit dispute" },
      {
        name: "description",
        content: "Chat with RentResolve about your tenancy deposit dispute in England.",
      },
      { property: "og:title", content: "RentResolve — Chat about your deposit" },
      {
        property: "og:description",
        content:
          "Start a conversation about your deposit dispute, with separate maintained legal guidance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RentChat,
});
