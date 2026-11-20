import { z } from "zod";
import { ISSUE_TYPES } from "./issues";

export const chatInputSchema = z.object({
  consent: z.literal(true),
  issueType: z.enum(ISSUE_TYPES).default("deposit"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .refine(
      (messages) => messages.reduce((sum, message) => sum + message.content.length, 0) <= 200000,
      "This chat is too long. Clear the chat before continuing.",
    ),
});

export type ChatEvent =
  { type: "text"; text: string } | { type: "done" } | { type: "error"; message: string };
