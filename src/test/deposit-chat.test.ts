import { describe, expect, it } from "vitest";
import { answerField, canOpenDepositCase, caseFromChat, emptyChatCase, mergeExtraction, nextDepositQuestion, normaliseValue, memoryProblems, type DepositField, type Extraction } from "@/lib/chat-case";

const extracted = (field: DepositField, value: string, quote: string, certainty: "explicit" | "inferred" = "explicit"): Extraction => ({ acknowledgement: "Thanks", updates: [{ field, value, quote, certainty, messageIndex: 0 }] });
const merge = (field: DepositField, value: string, quote: string) => mergeExtraction(emptyChatCase(), extracted(field, value, quote), [{ role: "user", content: quote }]);

describe("deposit conversation memory", () => {
  it("never re-asks a confirmed move-out date of 1 November 2026", () => {
    const memory = merge("moveOutDate", "2026-11-01", "I moved out on 1 November 2026.");
    expect(memory.fields.moveOutDate?.value).toBe("2026-11-01");
    let next = memory;
    for (let i = 0; i < 15; i++) {
      const field = nextDepositQuestion(next);
      if (!field) break;
      expect(field).not.toBe("moveOutDate");
      next = answerField(next, field, "", true);
    }
  });
  it("preserves user-reported £1,800 deposit and £1,200 disputed amount", () => {
    const message = "My deposit was £1,800 and I dispute £1,200.";
    const memory = mergeExtraction(emptyChatCase(), { acknowledgement: "Thanks", updates: [
      ...extracted("depositAmount", "1800", message).updates,
      ...extracted("disputedAmount", "1200", message).updates,
    ] }, [{ role: "user", content: message }]);
    expect(memory.fields.depositAmount?.value).toBe("1800");
    expect(memory.fields.disputedAmount?.value).toBe("1200");
    expect(nextDepositQuestion(answerField(memory, "tenantView", "I disagree"))).toBe("deductionReason");
  });
  it("asks for clarification instead of choosing between contradictory dates", () => {
    const initial = merge("moveOutDate", "2026-11-01", "I moved out on 1 November 2026.");
    const conflicting = mergeExtraction(initial, extracted("moveOutDate", "2026-11-03", "I moved out on 3 November 2026."), [{ role: "user", content: "I moved out on 3 November 2026." }]);
    expect(conflicting.fields.moveOutDate?.status).toBe("conflicting");
    expect(conflicting.fields.moveOutDate?.alternatives).toEqual(["2026-11-01", "2026-11-03"]);
    expect(nextDepositQuestion(conflicting)).toBe("moveOutDate");
    expect(answerField(conflicting, "moveOutDate", "2026-11-03").fields.moveOutDate?.status).toBe("confirmed");
  });
  it("recognises explicit corrections without keeping the obsolete answer", () => {
    const old = answerField(emptyChatCase(), "depositAmount", "1800");
    const quote = "Actually, my deposit was £1,900.";
    const result = mergeExtraction(old, extracted("depositAmount", "1900", quote), [{ role: "user", content: quote }]);
    expect(result.fields.depositAmount?.value).toBe("1900");
    expect(result.fields.depositAmount?.status).toBe("confirmed");
  });
  it("withholds invented source quotes and assistant speculation", () => {
    expect(mergeExtraction(emptyChatCase(), extracted("depositAmount", "1800", "£1800"), [{ role: "user", content: "Hello" }]).fields.depositAmount).toBeUndefined();
    expect(mergeExtraction(emptyChatCase(), extracted("depositAmount", "1800", "£1800"), [{ role: "assistant", content: "£1800" }]).fields.depositAmount).toBeUndefined();
  });
  it("rejects invented amounts and years even when the quote exists", () => {
    expect(merge("depositAmount", "1800", "My deposit was £900").fields.depositAmount).toBeUndefined();
    expect(merge("moveOutDate", "2026-11-01", "I moved out on 1 November").fields.moveOutDate).toBeUndefined();
    expect(normaliseValue("moveOutDate", "2026-02-30")).toBeNull();
  });
  it("keeps inferred details awaiting verification", () => {
    const quote = "Maybe I moved out on 1 November 2026";
    const result = mergeExtraction(emptyChatCase(), extracted("moveOutDate", "2026-11-01", quote, "inferred"), [{ role: "user", content: quote }]);
    expect(result.fields.moveOutDate?.status).toBe("inferred");
    expect(nextDepositQuestion(result)).toBe("moveOutDate");
  });
  it("remembers optional skips without inventing completion", () => {
    const memory = answerField(emptyChatCase(), "tenantView", "", true);
    expect(memory.fields.tenantView?.status).toBe("missing");
    expect(nextDepositQuestion(memory)).toBe("depositAmount");
    expect(nextDepositQuestion(JSON.parse(JSON.stringify(memory)))).toBe("depositAmount");
  });
  it("does not ask about a response if the landlord has not been contacted", () => {
    let memory = answerField(emptyChatCase(), "contacted", "No");
    for (let i = 0; i < 15; i++) {
      const field = nextDepositQuestion(memory);
      if (!field) break;
      expect(field).not.toBe("responded");
      memory = answerField(memory, field, "", true);
    }
  });
  it("flags a disputed amount greater than the deposit", () => {
    const memory = answerField(answerField(emptyChatCase(), "depositAmount", "900"), "disputedAmount", "1200");
    expect(memoryProblems(memory)).toHaveLength(1);
  });
  it("transfers reviewed facts and keeps move-out separate from tenancy end", () => {
    let memory = emptyChatCase();
    for (const [field, value] of [["tenantView", "I disagree with replacing the carpet"], ["deductionReason", "Carpet replacement"], ["depositAmount", "1800"], ["disputedAmount", "1200"], ["moveOutDate", "2026-11-01"], ["tenancyEnd", "2026-11-05"]] as const) memory = answerField(memory, field, value);
    const saved = caseFromChat(memory, null);
    expect(saved.depositAmount).toBe(1800);
    expect(saved.disputedAmount).toBe(1200);
    expect(saved.moveOutDate).toBe("2026-11-01");
    expect(saved.tenancyEnd).toBe("2026-11-05");
    expect(saved.timeline.map(t => t.date)).toEqual(["2026-11-01", "2026-11-05"]);
    const updated = caseFromChat(answerField(memory, "disputedAmount", "1100"), { ...saved, documents: [{ key: "photos", label: "Photos", status: "have", note: "Reviewed" }], letter: "My edited letter" });
    expect(updated.caseId).toBe(saved.caseId);
    expect(updated.documents[0]?.note).toBe("Reviewed");
    expect(updated.letter).toBe("My edited letter");
  });
  it("cannot pass missing financial amounts off as zero on the dashboard", () => {
    expect(() => caseFromChat(emptyChatCase(), null)).toThrow("Please confirm");
  });
  it("does not overwrite a reviewed correction by re-extracting older history", () => {
    const memory = answerField(emptyChatCase(), "depositAmount", "1900");
    const result = mergeExtraction(memory, extracted("depositAmount", "1800", "My deposit was £1800"), [
      { role: "user", content: "My deposit was £1800" },
      { role: "assistant", content: "Thank you" },
      { role: "user", content: "I have photos" },
    ]);
    expect(result.fields.depositAmount?.value).toBe("1900");
    expect(result.fields.depositAmount?.status).toBe("confirmed");
  });
  it("withholds generated text conclusions that are not in the source quote", () => {
    expect(merge("tenantView", "The landlord committed fraud", "The carpet was worn").fields.tenantView).toBeUndefined();
  });
  it("does not turn an uncertain correction into an accepted fact", () => {
    const memory = answerField(emptyChatCase(), "depositAmount", "1800");
    const quote = "Actually, maybe my deposit was £1900";
    const result = mergeExtraction(memory, extracted("depositAmount", "1900", quote, "inferred"), [{ role: "user", content: quote }]);
    expect(result.fields.depositAmount?.status).toBe("conflicting");
  });
  it("requires four confirmed core answers before the dashboard handoff", () => {
    let memory = emptyChatCase();
    expect(canOpenDepositCase(memory)).toBe(false);
    for (const [field, value] of [["tenantView", "The carpet was worn"], ["deductionReason", "Carpet replacement"], ["depositAmount", "1800"], ["disputedAmount", "1200"]] as const) memory = answerField(memory, field, value);
    expect(canOpenDepositCase(memory)).toBe(true);
    expect(canOpenDepositCase(answerField(memory, "disputedAmount", "", true))).toBe(false);
    expect(canOpenDepositCase(answerField(memory, "disputedAmount", "1900"))).toBe(false);
  });
});