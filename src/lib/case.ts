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

function addDays(iso: string, days: number) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
    a.tenancyStart && { date: addDays(a.tenancyStart, 30), label: "Deadline for landlord to protect deposit (30 days)" },
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

export const SAMPLE_CASE: Case = {
  isSample: true,
  tenantName: "Maya Okafor",
  landlordName: "Northgate Lettings",
  address: "14 Elmfield Terrace, Leeds LS6",
  tenancyStart: "2025-09-01",
  tenancyEnd: "2026-06-30",
  depositAmount: 1800,
  disputedAmount: 1200,
  scheme: "DPS",
  deductionReason: "Full replacement of the bedroom carpet",
  tenantView:
    "The check-in inventory already recorded the carpet as 'worn, with light marks near the window', and I understand it was around eight years old. Any marks at check-out look like normal wear and tear from ten months of use, and I don't think I should pay for a full new carpet.",
  summary:
    "Maya, a second-year student, rented a room in a shared house for 10 months. The agent proposes keeping £1,200 of her £1,800 deposit to replace a bedroom carpet. Maya disagrees: the carpet was already worn at check-in and is believed to be about eight years old.",
  documents: [
    { key: "agreement", label: "Tenancy agreement", status: "have", note: "Signed 12 Aug 2025. Clause 9 covers cleaning and damage." },
    { key: "checkin", label: "Check-in inventory", status: "have", note: "Dated 1 Sep 2025. Bedroom carpet: 'worn, light marks near window'." },
    { key: "checkout", label: "Check-out report", status: "have", note: "Dated 2 Jul 2026. Notes 'staining by desk and window'." },
    { key: "photos", label: "Move-in / move-out photos", status: "have", note: "22 phone photos taken on moving out, timestamped." },
    { key: "certificate", label: "Deposit protection certificate", status: "have", note: "DPS custodial scheme, protected 8 Sep 2025." },
    { key: "invoice", label: "Landlord's invoice or quote", status: "missing", note: "Agent has not shared one yet." },
    { key: "messages", label: "Emails or messages with landlord/agent", status: "have", note: "Email of 9 Jul 2026 proposing the deduction." },
  ],
  timeline: [
    { date: "2025-09-01", label: "Tenancy started; check-in inventory completed" },
    { date: "2025-09-08", label: "Deposit protected with DPS (within 30 days)" },
    { date: "2026-06-30", label: "Tenancy ended; keys returned" },
    { date: "2026-07-02", label: "Check-out inspection by agent" },
    { date: "2026-07-09", label: "Agent emails proposing £1,200 carpet deduction" },
    { date: "2026-07-14", label: "Maya replies to say she disagrees" },
  ],
  facts: [
    { text: "Deposit of £1,800 was paid and protected with the DPS on 8 Sep 2025.", source: "Deposit protection certificate" },
    { text: "The bedroom carpet was recorded as 'worn, light marks near window' at check-in.", source: "Check-in inventory" },
    { text: "The check-out report notes staining by the desk and window.", source: "Check-out report" },
    { text: "The agent proposes deducting £1,200 for a full carpet replacement.", source: "Email, 9 Jul 2026" },
    { text: "£600 of the deposit is not in dispute.", source: "Email, 9 Jul 2026" },
  ],
  missing: [
    "Invoice or quote showing the actual cost of the new carpet",
    "Evidence of the carpet's age (e.g. purchase date or previous inventories)",
    "Whether cleaning was considered instead of full replacement",
    "Clear close-up photos of the marks from the check-out inspection",
  ],
  nextSteps: [
    "Ask the agent for the carpet invoice and its age (draft email ready).",
    "Ask for the undisputed £600 to be returned now.",
    "Gather your move-out photos into one folder with dates.",
    "If no agreement, raise a free dispute with the DPS — it must be within 3 months of the tenancy ending.",
  ],
  letter: "",
};
SAMPLE_CASE.letter = buildLetter(SAMPLE_CASE);
