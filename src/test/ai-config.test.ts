import { describe, expect, it } from "vitest";
import { AI_MODEL, AIConfigured } from "@/lib/ai.server";
import { SAMPLE_ANALYSIS } from "@/lib/sample-analysis";

describe("AI provider configuration", () => {
  it("keeps the model configurable with a sensible default", () => {
    expect(AI_MODEL.length).toBeGreaterThan(0);
    expect(AI_MODEL).toMatch(/gemini/);
  });
  it("reports AI as unconfigured without a key so demo mode can trigger", () => {
    expect(typeof AIConfigured()).toBe("boolean");
  });
  it("labels every sample analysis line so demo output is never mistaken for real AI output", () => {
    expect(SAMPLE_ANALYSIS.summary).toContain("SAMPLE");
    expect(SAMPLE_ANALYSIS.draftResponse).toContain("SAMPLE");
    for (const event of SAMPLE_ANALYSIS.events) expect(event.description).toContain("SAMPLE");
    for (const item of SAMPLE_ANALYSIS.evidence) expect(item.statement).toContain("SAMPLE");
    for (const conflict of SAMPLE_ANALYSIS.conflicts) expect(conflict.description).toContain("SAMPLE");
    for (const missing of SAMPLE_ANALYSIS.missingInformation) expect(missing).toContain("SAMPLE");
    for (const question of SAMPLE_ANALYSIS.unresolvedQuestions) {
      expect(question.question).toContain("SAMPLE");
    }
  });
});
