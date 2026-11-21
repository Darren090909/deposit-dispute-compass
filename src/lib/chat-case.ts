import { z } from "zod";
import { parse, isValid, format } from "date-fns";
import { buildCase, DOC_TYPES, type Case, type Scheme } from "./case";

// Workflow definitions are independent of extraction and memory merging so additional
// categories can use the same pipeline without weakening the deposit rules.
export const DEPOSIT_FIELDS = ["tenantView", "depositAmount", "disputedAmount", "deductionReason", "moveOutDate", "tenancyStart", "tenancyEnd", "scheme", "contacted", "responded", "writtenReason", "evidence", "tenantName", "landlordName", "address"] as const;
export type DepositField = typeof DEPOSIT_FIELDS[number];
export interface FieldDefinition {
  label: string;
  question: string;
  why: string;
  type: "text" | "date" | "amount" | "choice";
  options?: readonly string[];
}
export const DEPOSIT_WORKFLOW: Record<DepositField, FieldDefinition> = {
  tenantView: { label: "Your explanation", question: "What happened, and why do you disagree with the deduction?", why: "Your own explanation is the starting point.", type: "text" },
  depositAmount: { label: "Deposit amount", question: "How much was your deposit?", why: "This helps keep the financial summary accurate.", type: "amount" },
  disputedAmount: { label: "Amount disputed", question: "How much of the deduction are you disputing?", why: "This may be different from the total deduction.", type: "amount" },
  deductionReason: { label: "Landlord’s reason", question: "What reason did the landlord give for the deduction?", why: "We will record this as their stated reason, not a proven fact.", type: "text" },
  moveOutDate: { label: "Move-out date", question: "When did you move out?", why: "This anchors the chronology; it may differ from your tenancy end date.", type: "date" },
  tenancyStart: { label: "Tenancy start", question: "When did your tenancy start?", why: "This helps place the evidence in context.", type: "date" },
  tenancyEnd: { label: "Tenancy end", question: "When did your tenancy end?", why: "We keep this separate from when you moved out.", type: "date" },
  scheme: { label: "Deposit protection", question: "Which scheme protected your deposit?", why: "This helps identify the relevant maintained guidance.", type: "choice", options: ["DPS", "mydeposits", "TDS", "not-protected"] },
  contacted: { label: "Landlord contacted", question: "Have you contacted your landlord about the deduction?", why: "This helps identify a useful next step.", type: "choice", options: ["Yes", "No"] },
  responded: { label: "Landlord response", question: "Has your landlord responded?", why: "Their response can help identify what remains unresolved.", type: "choice", options: ["Yes", "No"] },
  writtenReason: { label: "Written explanation", question: "Has the landlord explained the deduction in writing?", why: "Written correspondence can help document their position.", type: "choice", options: ["Yes, by email or letter", "No, nothing in writing", "Only verbally"] },
  evidence: { label: "Available evidence", question: "Which supporting evidence do you already have?", why: "A list is enough for now; you can upload documents for analysis later.", type: "text" },
  tenantName: { label: "Your name (optional)", question: "What name should appear on your case?", why: "You can leave this blank until preparing correspondence.", type: "text" },
  landlordName: { label: "Landlord or agent (optional)", question: "Who is the landlord or agent?", why: "Optional until you prepare correspondence.", type: "text" },
  address: { label: "Property address (optional)", question: "What address is this case about?", why: "Optional; avoid personal details you do not want to send.", type: "text" },
};
export const fieldSchema = z.object({
  value: z.string().max(5000),
  status: z.enum(["confirmed", "inferred", "missing", "conflicting"]),
  source: z.string().max(2000),
  alternatives: z.array(z.string().max(5000)).max(10),
  skipped: z.boolean(),
});
export const chatCaseSchema = z.object({
  category: z.literal("deposit"),
  fields: z.record(z.enum(DEPOSIT_FIELDS), fieldSchema),
});
export type ChatCase = z.infer<typeof chatCaseSchema>;
export const emptyChatCase = (): ChatCase => ({ category: "deposit", fields: {} });
export const extractionSchema = z.object({
  acknowledgement: z.string().max(800),
  updates: z.array(z.object({
    field: z.enum(DEPOSIT_FIELDS), value: z.string().max(5000),
    messageIndex: z.number().int().min(0), quote: z.string().min(1).max(2000),
    certainty: z.enum(["explicit", "inferred"]),
  })).max(35),
});
export type Extraction = z.infer<typeof extractionSchema>;

export function normaliseValue(field: DepositField, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const definition = DEPOSIT_WORKFLOW[field];
  if (definition.type === "amount") {
    const n = Number(trimmed.replace(/[£,\s]/g, ""));
    return Number.isFinite(n) && n > 0 && n <= 10000000 ? String(n) : null;
  }
  if (definition.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const date = parse(trimmed, "yyyy-MM-dd", new Date(2000, 0, 1));
    return isValid(date) && format(date, "yyyy-MM-dd") === trimmed ? trimmed : null;
  }
  if (definition.options) return definition.options.find(o => o.toLowerCase() === trimmed.toLowerCase()) ?? null;
  return trimmed;
}

function quoteSupports(field: DepositField, value: string, quote: string): boolean {
  const definition = DEPOSIT_WORKFLOW[field];
  if (definition.type === "amount") {
    return (quote.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).some(n => Number(n.replaceAll(",", "")) === Number(value));
  }
  if (definition.type === "date") {
    if (quote.includes(value)) return true;
    const cleaned = quote.replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
    const candidates = cleaned.match(/\b\d{1,2}[ /-](?:[A-Za-z]+|\d{1,2})[ ,/-]+\d{4}\b|\b[A-Za-z]+ \d{1,2},? \d{4}\b/g) ?? [];
    return candidates.some(candidate => ["d MMMM yyyy", "d MMM yyyy", "d/M/yyyy", "d-M-yyyy", "MMMM d, yyyy", "MMMM d yyyy"].some(pattern => {
      const date = parse(candidate, pattern, new Date(2000, 0, 1));
      return isValid(date) && format(date, "yyyy-MM-dd") === value;
    }));
  }
  return true;
}

export function mergeExtraction(memory: ChatCase, extraction: Extraction, messages: { role: string; content: string }[]): ChatCase {
  const fields = { ...memory.fields };
  for (const update of extraction.updates) {
    const message = messages[update.messageIndex];
    const value = normaliseValue(update.field, update.value);
    // A generated source cannot give an assistant's speculation user authority.
    if (!message || message.role !== "user" || !message.content.includes(update.quote) || !value || !quoteSupports(update.field, value, update.quote)) continue;
    const old = fields[update.field];
    if (old?.value === value) continue; // Preserve explicit edits, provenance and skip decisions.
    const correction = /\b(actually|correction|correct that|instead|i meant|not .+ but)\b/i.test(update.quote);
    if (old && old.status !== "missing" && old.value && old.value !== value && !correction) {
      fields[update.field] = { ...old, status: "conflicting", skipped: false, alternatives: [...new Set([old.value, ...old.alternatives, value])].slice(0, 10), source: `${old.source}; Chat: ${update.quote}`.slice(0, 2000) };
    } else {
      fields[update.field] = { value, status: update.certainty === "explicit" ? "confirmed" : "inferred", source: `Chat: ${update.quote}`, alternatives: [], skipped: false };
    }
  }
  return { category: "deposit", fields };
}

export function answerField(memory: ChatCase, field: DepositField, raw: string, skip = false): ChatCase {
  const value = skip ? "" : normaliseValue(field, raw);
  if (!skip && !value) throw new Error("Please enter a valid answer.");
  return { ...memory, fields: { ...memory.fields, [field]: { value: value ?? "", status: skip ? "missing" : "confirmed", source: skip ? "You chose not to answer yet" : "Your reviewed answer", alternatives: [], skipped: skip } } };
}

export function nextDepositQuestion(memory: ChatCase): DepositField | null {
  const relevant = DEPOSIT_FIELDS.filter(f => !["tenantName", "landlordName", "address"].includes(f) && !(f === "responded" && memory.fields.contacted?.value === "No"));
  const unresolved = relevant.find(f => ["conflicting", "inferred"].includes(memory.fields[f]?.status ?? ""));
  if (unresolved) return unresolved;
  return relevant.find(f => (!memory.fields[f] || memory.fields[f]?.status === "missing") && !memory.fields[f]?.skipped) ?? null;
}

export function memoryProblems(memory: ChatCase): string[] {
  const value = (field: DepositField) => memory.fields[field]?.status === "confirmed" ? memory.fields[field]?.value ?? "" : "";
  const problems: string[] = [];
  if (value("depositAmount") && value("disputedAmount") && Number(value("disputedAmount")) > Number(value("depositAmount"))) problems.push("The disputed amount is greater than the deposit. Please check both amounts.");
  if (value("tenancyStart") && value("tenancyEnd") && value("tenancyEnd") < value("tenancyStart")) problems.push("The tenancy end is before the tenancy start. Please check the dates.");
  return problems;
}

export function caseFromChat(memory: ChatCase, previous: Case | null): Case {
  const value = (f: DepositField) => memory.fields[f]?.status === "confirmed" ? memory.fields[f]?.value ?? "" : "";
  if (!value("depositAmount") || !value("disputedAmount") || !value("deductionReason") || !value("tenantView")) throw new Error("Please confirm your explanation, the landlord’s reason, deposit amount and disputed amount before opening the dashboard.");
  if (DEPOSIT_FIELDS.some(f => memory.fields[f]?.status === "conflicting")) throw new Error("Please resolve conflicting answers before saving your case.");
  const problem = memoryProblems(memory)[0];
  if (problem) throw new Error(problem);
  const base = buildCase({ issueType: "deposit", tenantName: value("tenantName"), landlordName: value("landlordName"), address: value("address"), tenancyStart: value("tenancyStart"), tenancyEnd: value("tenancyEnd"), depositAmount: Number(value("depositAmount")), disputedAmount: Number(value("disputedAmount")), scheme: (value("scheme") || "unknown") as Scheme, deductionReason: value("deductionReason"), tenantView: value("tenantView"), documents: {} });
  const sameCase = previous?.issueType === "deposit" || (previous && !previous.issueType);
  const merged = sameCase && previous ? { ...base, caseId: previous.caseId, documents: previous.documents, analysis: previous.analysis, letter: previous.letter, letterOrigin: previous.letterOrigin } : base;
  return { ...merged, moveOutDate: value("moveOutDate"), chatMemory: memory,
    summary: `You report: ${value("tenantView")}\n\nYou dispute £${value("disputedAmount")} from a £${value("depositAmount")} deposit. Landlord’s stated reason: ${value("deductionReason")}.`,
    facts: DEPOSIT_FIELDS.flatMap(f => value(f) ? [{ text: `${DEPOSIT_WORKFLOW[f].label}: ${value(f)}`, source: memory.fields[f]?.source ?? "Your reviewed answers" }] : []),
    timeline: [...base.timeline, ...(value("moveOutDate") ? [{ date: value("moveOutDate"), label: "Moved out", id: crypto.randomUUID(), source: memory.fields.moveOutDate?.source ?? "Your answers", origin: "intake" as const }] : []), ...(sameCase ? previous?.timeline.filter(t => t.origin !== "intake") ?? [] : [])].sort((a,b) => a.date.localeCompare(b.date)),
    missing: DEPOSIT_FIELDS.filter(f => !value(f)).map(f => `${DEPOSIT_WORKFLOW[f].label} — ${memory.fields[f]?.status ?? "missing"}`),
    documents: merged.documents.length ? merged.documents : DOC_TYPES.map(d => ({ ...d, status: "unsure" as const, note: "" })),
  };
}