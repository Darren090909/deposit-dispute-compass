import { describe, expect, it } from "vitest";
import { buildCase, SAMPLE_CASE, validateIntake, type IntakeAnswers } from "@/lib/case";

const base: IntakeAnswers = {
  tenantName: "Sam", landlordName: "L", address: "A", tenancyStart: "2025-09-01", tenancyEnd: "2026-06-30",
  depositAmount: 1800, disputedAmount: 1200, scheme: "DPS", deductionReason: "Carpet", tenantView: "", documents: {},
};

describe("case rules", () => {
  it("sample case is a £1,200 deduction from an £1,800 deposit", () => {
    expect(SAMPLE_CASE.depositAmount).toBe(1800);
    expect(SAMPLE_CASE.disputedAmount).toBe(1200);
  });
  it("rejects a disputed amount larger than the deposit", () => {
    expect(validateIntake({ ...base, disputedAmount: 2000 })).toContain("The disputed amount can't be more than the deposit.");
  });
  it("does not infer a legal deadline from a tenancy start date without a deposit receipt date", () => {
    expect(buildCase(base).timeline.map(t => t.date)).toEqual(["2025-09-01", "2026-06-30"]);
  });
});
