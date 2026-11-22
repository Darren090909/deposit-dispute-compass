import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/case-ui";
import { useCase } from "@/lib/case-store";
import { buildCase, DOC_TYPES, SCHEME_LABELS, validateIntake, type DocStatus, type IntakeAnswers, type Scheme } from "@/lib/case";
import { EMPTY_REPAIR, ISSUE_LABELS, ISSUE_TYPES, issueOf, type IssueType } from "@/lib/issues";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Start my case — RentResolve" },
      { name: "description", content: "Guided questions for deposit disputes, damp and mould, and unresolved repairs in England." },
      { property: "og:title", content: "Start my case — RentResolve" },
      { property: "og:description", content: "Create a structured tenancy case with issue-specific questions and evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Intake,
  validateSearch: (search: Record<string, unknown>): { issue?: IssueType } => {
    const issue = search["issue"];
    return ISSUE_TYPES.includes(issue as IssueType) ? { issue: issue as IssueType } : {};
  },
});

const EMPTY: IntakeAnswers = {
  tenantName: "", landlordName: "", address: "", tenancyStart: "", tenancyEnd: "",
  depositAmount: 0, disputedAmount: 0, scheme: "unknown", deductionReason: "", tenantView: "",
  documents: Object.fromEntries(DOC_TYPES.map((d) => [d.key, "unsure" as DocStatus])),
};

const STEP_TITLES: string[] = ["Your tenancy", "The deposit", "The dispute", "Your documents"];

function Intake() {
  const { current, setCase } = useCase();
  const { issue } = Route.useSearch();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<IntakeAnswers>(() => current && (!issue || issue === issueOf(current)) ? { ...current, documents: Object.fromEntries(current.documents.map(d => [d.key, d.status])) } : { ...EMPTY, issueType: issue ?? "deposit", repair: { ...EMPTY_REPAIR } });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const set = <K extends keyof IntakeAnswers>(k: K, v: IntakeAnswers[K]) => setA((p) => ({ ...p, [k]: v }));
  const repairCase = issueOf(a) !== "deposit";
  const r = a.repair ?? EMPTY_REPAIR;
  const setRepair = <K extends keyof typeof r>(key: K, value: typeof r[K]) => set("repair", { ...r, [key]: value });
  const titles = repairCase ? ["Your tenancy", "The problem", "Landlord response", "Your documents"] : STEP_TITLES;

  const submit = () => {
    const e = validateIntake(a);
    setErrors(e);
    if (e.length) return;
    setBusy(true);
    const built = buildCase(a);
    if (current && issueOf(current) === issueOf(a)) {
      const changed = JSON.stringify({ ...current, documents: a.documents }) !== JSON.stringify({ ...current, ...a });
      setCase({ ...built, ...(current.caseId ? { caseId: current.caseId } : {}), analysis: changed ? undefined : current.analysis,
        timeline: [...built.timeline, ...current.timeline.filter(t => t.origin !== "intake" && !(t.origin === undefined && ["Tenancy started", "Tenancy ended"].includes(t.label)))],
        letter: current.letterOrigin === "ai" && !changed ? current.letter : built.letter,
        letterOrigin: current.letterOrigin === "ai" && !changed ? "ai" : "template" });
    } else {
      if (current && !confirm("Replace your open case and delete its saved evidence?")) { setBusy(false); return; }
      setCase(built);
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <PageHeader eyebrow={`Step ${step + 1} of 4`} title={titles[step] ?? ""} intro="Answer what you can — you can edit everything later." />
      <div className="mb-6 flex gap-2" aria-hidden>
        {titles.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />)}
      </div>

      <div className="card-soft space-y-5 p-6 md:p-8">
        {step === 0 && (
          <>
            <fieldset><legend className="mb-2 text-sm font-semibold">Tenancy issue</legend><div className="flex flex-wrap gap-2">{ISSUE_TYPES.map(type => <Button key={type} variant={issueOf(a) === type ? "default" : "outline"} aria-pressed={issueOf(a) === type} onClick={() => set("issueType", type)}>{ISSUE_LABELS[type]}</Button>)}</div></fieldset>
            <Field id="name" label="Your name"><Input id="name" value={a.tenantName} onChange={(e) => set("tenantName", e.target.value)} /></Field>
            <Field id="ll" label="Landlord or letting agent"><Input id="ll" value={a.landlordName} onChange={(e) => set("landlordName", e.target.value)} /></Field>
            <Field id="addr" label="Property address"><Input id="addr" value={a.address} onChange={(e) => set("address", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="start" label="Tenancy start"><Input id="start" type="date" value={a.tenancyStart} onChange={(e) => set("tenancyStart", e.target.value)} /></Field>
              <Field id="end" label="Tenancy end"><Input id="end" type="date" value={a.tenancyEnd} onChange={(e) => set("tenancyEnd", e.target.value)} /></Field>
            </div>
          </>
        )}
        {step === 1 && !repairCase && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="dep" label="Deposit paid (£)"><Input id="dep" type="number" min={0} value={a.depositAmount || ""} onChange={(e) => set("depositAmount", Number(e.target.value))} /></Field>
              <Field id="dis" label="Amount they want to keep (£)"><Input id="dis" type="number" min={0} value={a.disputedAmount || ""} onChange={(e) => set("disputedAmount", Number(e.target.value))} /></Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Which scheme protects your deposit?</legend>
              <div className="grid gap-2">
                {(Object.keys(SCHEME_LABELS) as Scheme[]).map((s) => (
                  <label key={s} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${a.scheme === s ? "border-accent bg-teal-soft" : "border-border"}`}>
                    <input type="radio" name="scheme" checked={a.scheme === s} onChange={() => set("scheme", s)} className="accent-[var(--accent)]" />
                    {SCHEME_LABELS[s]}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {step === 2 && !repairCase && (
          <>
            <Field id="reason" label="What is the deduction for?"><Input id="reason" placeholder="e.g. carpet replacement, cleaning" value={a.deductionReason} onChange={(e) => set("deductionReason", e.target.value)} /></Field>
            <Field id="view" label="Why do you disagree? (in your own words)"><Textarea id="view" rows={5} value={a.tenantView} onChange={(e) => set("tenantView", e.target.value)} /></Field>
          </>
        )}
        {step === 1 && repairCase && <>
          <Field id="problem" label="Describe the problem"><Textarea id="problem" rows={4} value={r.problem} onChange={e => setRepair("problem", e.target.value)} /></Field>
          <Field id="appeared" label="When did it first appear?"><Input id="appeared" type="date" value={r.appeared} onChange={e => setRepair("appeared", e.target.value)} /></Field>
          <Choice label="Is the problem worsening?" value={r.worsening} onChange={v => setRepair("worsening", v)} />
          <Field id="safety" label="Any immediate health or safety concerns?"><Textarea id="safety" value={r.safety} onChange={e => setRepair("safety", e.target.value)} /></Field>
          {r.safety.trim() && <p role="alert" className="border-l-4 border-destructive p-3 text-sm">Do not wait for AI analysis if there is immediate danger. Contact emergency services where needed and seek urgent professional help.</p>}
        </>}
        {step === 2 && repairCase && <>
          <Choice label="Have you notified the landlord?" value={r.notified} onChange={v => setRepair("notified", v)} />
          {r.notified === "yes" && <Field id="notifiedDate" label="When did you notify them?"><Input id="notifiedDate" type="date" value={r.notifiedDate} onChange={e => setRepair("notifiedDate", e.target.value)} /></Field>}
          <Field id="response" label="How did the landlord respond?"><Textarea id="response" value={r.response} onChange={e => setRepair("response", e.target.value)} /></Field>
          <Choice label="Have repairs been attempted?" value={r.attempted} onChange={v => setRepair("attempted", v)} />
          {r.attempted === "yes" && <Field id="repairDetails" label="What was done, and when?"><Textarea id="repairDetails" value={r.repairDetails} onChange={e => setRepair("repairDetails", e.target.value)} /></Field>}
        </>}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Which of these do you have?</p>
            {DOC_TYPES.filter(d => !repairCase || ["agreement", "photos", "messages", "invoice"].includes(d.key)).map((d) => (
              <div key={d.key} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{d.label}</span>
                <div className="flex gap-1" role="group" aria-label={d.label}>
                  {(["have", "missing", "unsure"] as DocStatus[]).map((st) => (
                    <Button key={st} variant="ghost" size="sm" type="button" onClick={() => set("documents", { ...a.documents, [d.key]: st })}
                      className={`rounded-full px-3 py-1 text-sm ${(a.documents[d.key] ?? "unsure") === st ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {st === "have" ? "Have it" : st === "missing" ? "Don't have" : "Not sure"}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {errors.length > 0 && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive"><AlertCircle className="h-4 w-4" /> Please check a few things</p>
            <ul className="mt-2 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Continue</Button>
          ) : (
            <Button onClick={submit} disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Organising your answers…</> : current && issueOf(current) === issueOf(a) ? "Save case details" : "Create my case"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Choice({ label, value, onChange }: { label: string; value: "yes" | "no" | "unsure"; onChange: (v: "yes" | "no" | "unsure") => void }) {
  return <fieldset><legend className="mb-2 text-sm font-semibold">{label}</legend><div className="flex flex-wrap gap-2">{(["yes", "no", "unsure"] as const).map(v => <Button key={v} variant={v === value ? "default" : "outline"} aria-pressed={v === value} onClick={() => onChange(v)}>{v === "unsure" ? "Not sure" : v === "yes" ? "Yes" : "No"}</Button>)}</div></fieldset>;
}
