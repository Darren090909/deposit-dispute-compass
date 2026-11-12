import { describe, expect, it } from "vitest";
import { analysisInputSchema, analysisOutputSchema, analysisResponseSchema, UPLOAD_LIMITS, type AnalysisOutput } from "@/lib/analysis-schema";
import { SAMPLE_CASE } from "@/lib/case";
import { checkFile, chunkText } from "@/lib/extract";
import { canUseOutput, validateAnalysisSources } from "@/lib/analysis-utils";

const input = { consent: true, answers: SAMPLE_CASE, documents: [] };
const output: AnalysisOutput = { summary: "Neutral", events: [], evidence: [{ statement: "Worn carpet", kind: "documented", sourceRef: "inventory.txt, lines 1–3", supports: "tenant" }], conflicts: [], missingInformation: [], unresolvedQuestions: [], procedureNotes: [], draftResponse: "Dear agent" };

describe("analysis safeguards", () => {
  it("requires explicit consent", () => {
    expect(analysisInputSchema.safeParse({ ...input, consent: false }).success).toBe(false);
  });
  it("accepts no more than five documents", () => {
    const documents = Array.from({ length: 6 }, (_, i) => ({ filename: `${i}.txt`, chunks: [{ location: "lines 1–1", text: "Fictional evidence" }] }));
    expect(analysisInputSchema.safeParse({ ...input, documents: documents.slice(0, 5) }).success).toBe(true);
    expect(analysisInputSchema.safeParse({ ...input, documents }).success).toBe(false);
  });
  it("allows at most 5 MB per file", () => {
    expect(checkFile(new File([new Uint8Array(5 * 1024 * 1024)], "a.txt"))).toBeNull();
    expect(checkFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.txt"))).not.toBeNull();
  });
  it("accepts PDF, txt and md but rejects other file types", () => {
    for (const name of ["a.pdf", "a.txt", "a.md"]) expect(checkFile(new File(["text"], name))).toBeNull();
    expect(checkFile(new File(["text"], "a.docx"))).not.toBeNull();
  });
  it("enforces the total 120,000-character limit on the server schema", () => {
    const doc = (length: number) => ({ filename: `${length}.txt`, chunks: [{ location: "lines 1–1", text: "a".repeat(length) }] });
    expect(UPLOAD_LIMITS.maxTotalChars).toBe(120_000);
    expect(analysisInputSchema.safeParse({ ...input, documents: [doc(120_000)] }).success).toBe(true);
    expect(analysisInputSchema.safeParse({ ...input, documents: [doc(120_000), doc(1)] }).success).toBe(false);
  });
  it("preserves line references when chunking text", () => {
    const chunks = chunkText(Array.from({ length: 41 }, (_,i) => `line ${i+1}`).join("\n"));
    expect(chunks.map(c => c.location)).toEqual(["lines 1–40", "lines 41–41"]);
    expect(chunks[1]?.text).toBe("line 41");
  });
  it("rejects documents without readable text", () => {
    expect(analysisInputSchema.safeParse({ ...input, documents: [{ filename: "empty.txt", chunks: [] }] }).success).toBe(false);
  });
  it("rejects duplicate filenames to keep references unambiguous", () => {
    const doc = { filename: "inventory.txt", chunks: [{ location: "lines 1–1", text: "Fictional evidence" }] };
    expect(analysisInputSchema.safeParse({ ...input, documents: [doc, doc] }).success).toBe(false);
  });
  it("rejects fabricated procedural source identifiers", () => {
    expect(analysisOutputSchema.safeParse({ ...output, procedureNotes: [{ explanation: "Claim", sourceId: "invented-law" }] }).success).toBe(false);
  });
  it("rejects unknown fact classifications", () => {
    expect(analysisOutputSchema.safeParse({ ...output, evidence: [{ ...output.evidence[0], kind: "proven" }] }).success).toBe(false);
  });
  it("requires documented facts to cite a supplied file and location", () => {
    expect(validateAnalysisSources(output, [{ filename: "inventory.txt", chunks: [{ location: "lines 1–3", text: "Worn carpet" }] }])).toBe(true);
    expect(validateAnalysisSources(output, [])).toBe(false);
  });
  it("constrains generated references to supplied locations rather than invented subranges", () => {
    const schema = analysisResponseSchema([{ filename: "inventory.txt", chunks: [{ location: "lines 1–3", text: "Worn carpet" }] }]);
    expect(schema.safeParse(output).success).toBe(true);
    expect(schema.safeParse({ ...output, evidence: [{ ...output.evidence[0], sourceRef: "inventory.txt, lines 2–3" }] }).success).toBe(false);
  });
  it("blocks copying, exporting and using results before review", () => {
    expect(canUseOutput(false)).toBe(false);
    expect(canUseOutput(true)).toBe(true);
    expect(canUseOutput(true, true)).toBe(false);
  });
});