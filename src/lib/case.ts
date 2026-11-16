import type { AnalysisOutput } from "./analysis-schema";

export type DocStatus = "have" | "missing" | "unsure";
export type Scheme = "DPS" | "mydeposits" | "TDS" | "unknown" | "not-protected";

export interface CaseDoc {
  key: string;
  label: string;
  status: DocStatus;
  note: string;
}
export interface TimelineItem {
  date: string;
  label: string;
}
export interface Fact {
  text: string;
  source: string;
}

export interface Case {
  isSample: boolean;
  tenantName: string;
  landlordName: string;
  address: string;
  tenancyStart: string;
  tenancyEnd: string;
  depositAmount: number;
  disputedAmount: number;
  scheme: Scheme;
  deductionReason: string;
  tenantView: string;
  summary: string;
  documents: CaseDoc[];
  timeline: TimelineItem[];
  facts: Fact[];
  missing: string[];
  nextSteps: string[];
  letter: string;
  analysis?: AnalysisOutput | undefined;
  letterOrigin?: "ai" | "template";
}

export const DOC_TYPES: { key: string; label: string }[] = [
  { key: "agreement", label: "Tenancy agreement" },
  { key: "checkin", label: "Check-in inventory" },
  { key: "checkout", label: "Check-out report" },
  { key: "photos", label: "Move-in / move-out photos" },
  { key: "certificate", label: "Deposit protection certificate" },
  { key: "invoice", label: "Landlord's invoice or quote" },
  { key: "messages", label: "Emails or messages with landlord/agent" },
];

export const SCHEME_LABELS: Record<Scheme, string> = {
  DPS: "Deposit Protection Service (DPS)",
  mydeposits: "mydeposits",
  TDS: "Tenancy Deposit Scheme (TDS)",
  unknown: "Not sure",
  "not-protected": "I don't think it was protected",
};

export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (iso: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export interface IntakeAnswers {
  tenantName: string;
  landlordName: string;
  address: string;
  tenancyStart: string;
  tenancyEnd: string;
  depositAmount: number;
  disputedAmount: number;
  scheme: Scheme;
  deductionReason: string;
  tenantView: string;
  documents: Record<string, DocStatus>;
}

/** Returns a list of problems with the answers; empty means valid. */
export function validateIntake(a: IntakeAnswers): string[] {
  const errors: string[] = [];
  if (!a.tenantName.trim()) errors.push("Please add your name.");
  if (!(a.depositAmount > 0)) errors.push("Deposit amount must be more than £0.");
  if (!(a.disputedAmount > 0)) errors.push("Disputed amount must be more than £0.");
  if (a.disputedAmount > a.depositAmount) errors.push("The disputed amount can't be more than the deposit.");
  if (a.tenancyStart && a.tenancyEnd && a.tenancyEnd < a.tenancyStart)
    errors.push("The tenancy end date must be after the start date.");
  if (!a.deductionReason.trim()) errors.push("Tell us what the deduction is for.");
  return errors;
}

export function buildLetter(c: Pick<Case, "tenantName" | "landlordName" | "address" | "depositAmount" | "disputedAmount" | "deductionReason" | "tenantView" | "tenancyEnd" | "scheme">) {
  const scheme = c.scheme === "unknown" || c.scheme === "not-protected" ? "the relevant deposit protection scheme" : SCHEME_LABELS[c.scheme];
  return `Subject: Deposit deduction – ${c.address || "my former tenancy"}

Dear ${c.landlordName || "Landlord"},

I am writing about the proposed deduction of ${gbp(c.disputedAmount)} from my ${gbp(c.depositAmount)} deposit for ${c.address || "the property"}, which I left on ${fmtDate(c.tenancyEnd)}. The reason given was: ${c.deductionReason || "[reason]"}.

I do not agree with this deduction. ${c.tenantView || "[Explain briefly why you disagree.]"}

To help me understand the claim, please could you send me:
• the check-in and check-out reports you are relying on;
• any invoice or quote for the work;
• the age and condition of the item when the tenancy began.

I would like to resolve this fairly. I am happy to discuss a reasonable amount if there is evidence of damage beyond fair wear and tear. If we cannot agree, I intend to ask ${scheme} to resolve the dispute through its free dispute resolution service.

Please could you return the undisputed ${gbp(c.depositAmount - c.disputedAmount)} without delay, and reply about the remaining amount within 14 days.

Kind regards,
${c.tenantName || "[Your name]"}`;
}

export function buildCase(a: IntakeAnswers): Case {
  const documents: CaseDoc[] = DOC_TYPES.map((d) => ({ ...d, status: a.documents[d.key] ?? "unsure", note: "" }));
  const has = (k: string) => a.documents[k] === "have";
  const missing = documents.filter((d) => d.status !== "have").map((d) => `${d.label} — ${d.status === "missing" ? "not available yet" : "check whether you have this"}`);
  const facts: Fact[] = [
    { text: `Deposit paid: ${gbp(a.depositAmount)}.`, source: "Your answers" },
    { text: `Amount in dispute: ${gbp(a.disputedAmount)} for: ${a.deductionReason}.`, source: "Your answers" },
  ];
  if (a.scheme !== "unknown" && a.scheme !== "not-protected")
    facts.push({ text: `Deposit protected with ${SCHEME_LABELS[a.scheme]}.`, source: has("certificate") ? "Deposit certificate" : "Your answers" });
  if (has("checkin")) facts.push({ text: "A check-in inventory exists and can be compared with the check-out report.", source: "Check-in inventory" });
  const nextSteps = [
    "Check each fact below and correct anything that is wrong.",
    a.scheme === "not-protected" || a.scheme === "unknown"
      ? "Confirm whether your deposit was protected by searching the three official schemes."
      : `Find your ${SCHEME_LABELS[a.scheme]} reference number.`,
    "Send the landlord or agent a polite email asking for evidence (see Draft letter).",
    "If you can't agree, consider raising a free dispute with your deposit scheme.",
  ];
  const timeline: TimelineItem[] = [
    a.tenancyStart && { date: a.tenancyStart, label: "Tenancy started" },
    a.tenancyEnd && { date: a.tenancyEnd, label: "Tenancy ended" },
  ].filter(Boolean) as TimelineItem[];
  const base = { ...a };
  return {
    isSample: false,
    tenantName: base.tenantName,
    landlordName: base.landlordName,
    address: base.address,
    tenancyStart: base.tenancyStart,
    tenancyEnd: base.tenancyEnd,
    depositAmount: base.depositAmount,
    disputedAmount: base.disputedAmount,
    scheme: base.scheme,
    deductionReason: base.deductionReason,
    tenantView: base.tenantView,
    summary: `${a.tenantName} is disputing a ${gbp(a.disputedAmount)} deduction from a ${gbp(a.depositAmount)} deposit${a.address ? ` at ${a.address}` : ""}. The landlord's reason: ${a.deductionReason}.`,
    documents,
    timeline,
    facts,
    missing,
    nextSteps,
    letter: buildLetter(a),
  };
}

