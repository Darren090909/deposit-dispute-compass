import { describe, expect, it } from "vitest";
import { chatInputSchema } from "@/lib/chat-schema";
import { restoreCase } from "@/lib/case-store";
import { buildCase, type IntakeAnswers } from "@/lib/case";

describe("chat safeguards", () => {
  it("requires consent before messages reach AI", () => {
    expect(
      chatInputSchema.safeParse({ consent: false, messages: [{ role: "user", content: "Hello" }] })
        .success,
    ).toBe(false);
    expect(
      chatInputSchema.safeParse({ consent: true, messages: [{ role: "user", content: "Hello" }] })
        .success,
    ).toBe(true);
  });
  it("preserves every supplied conversation turn", () => {
    const messages = [
      { role: "user", content: "My deposit was £900" },
      { role: "assistant", content: "What was deducted?" },
      { role: "user", content: "£300" },
    ];
    expect(chatInputSchema.parse({ consent: true, messages }).messages).toEqual(messages);
  });
  it("removes a previously stored sample without removing a real case", () => {
    const answers: IntakeAnswers = {
      tenantName: "Test tenant",
      landlordName: "",
      address: "",
      tenancyStart: "",
      tenancyEnd: "",
      depositAmount: 900,
      disputedAmount: 300,
      scheme: "unknown",
      deductionReason: "Cleaning",
      tenantView: "",
      documents: {},
    };
    const real = buildCase(answers);
    expect(restoreCase(JSON.stringify({ ...real, isSample: true }))).toBeNull();
    expect(restoreCase(JSON.stringify(real))).toEqual(real);
  });
});
