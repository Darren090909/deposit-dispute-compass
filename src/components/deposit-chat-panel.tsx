import { useState } from "react";
import { Check, CalendarDays, ArrowRight, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEPOSIT_FIELDS, DEPOSIT_WORKFLOW, nextDepositQuestion, memoryProblems, type ChatCase, type DepositField } from "@/lib/chat-case";

interface Props {
  memory: ChatCase;
  busy: boolean;
  canSend: boolean;
  onAnswer: (field: DepositField, value: string, skip?: boolean) => void;
  onEdit: (field: DepositField, value: string, skip?: boolean) => void;
  onSave: () => void;
}

export function DepositChatPanel({ memory, busy, canSend, onAnswer, onEdit, onSave }: Props) {
  const field = nextDepositQuestion(memory);
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [reviewVersion, setReviewVersion] = useState("");
  const version = JSON.stringify(memory);
  const definition = field ? DEPOSIT_WORKFLOW[field] : null;
  const current = field ? memory.fields[field] : undefined;
  const problems = memoryProblems(memory);
  const respond = (value: string, skip = false) => {
    if (!field) return;
    onAnswer(field, value, skip);
    setAnswer("");
    setReviewed(false);
  };
  return <div className="space-y-5 border-t border-border pt-5">
    {field && definition && <div className="space-y-3" key={field}>
      <div className="flex items-center gap-2 text-sm font-medium text-primary"><CalendarDays className="h-4 w-4" />{current?.status === "conflicting" ? "Let’s clarify this" : current?.status === "inferred" ? "Please check this detail" : "One useful next detail"}</div>
      <p className="font-medium">{current?.status === "conflicting" ? `I have different answers for ${definition.label.toLowerCase()}. Which is correct?` : current?.status === "inferred" ? `Is this correct: ${definition.label} — ${current.value}?` : definition.question}</p>
      <p className="text-sm text-muted-foreground">{definition.why}</p>
      {current?.status === "conflicting" && <div className="flex flex-wrap gap-2">{current.alternatives.map(value => <Button key={value} variant="outline" disabled={!canSend || busy} onClick={() => respond(value)}>{value}</Button>)}</div>}
      {current?.status === "inferred" && <Button variant="outline" disabled={!canSend || busy} onClick={() => respond(current.value)}><Check />Confirm {current.value}</Button>}
      {definition.type === "choice" ? <div className="flex flex-wrap gap-2">{definition.options?.map(option => <Button key={option} variant="outline" className="h-auto min-h-10 whitespace-normal text-left" disabled={!canSend || busy} onClick={() => respond(option)}>{option === "not-protected" ? "I don’t think it was protected" : option}</Button>)}</div> : <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (answer.trim()) respond(answer); }}>
        {definition.type === "amount" && <span aria-hidden="true">£</span>}
        <Input key={field} type={definition.type === "date" ? "date" : definition.type === "amount" ? "number" : "text"} step={definition.type === "amount" ? "0.01" : undefined} min={definition.type === "amount" ? "0.01" : undefined} aria-label={definition.label} value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy} className="min-w-0 flex-1" />
        <Button type="submit" size="icon" title="Save answer" aria-label="Save answer" disabled={!canSend || busy || !answer.trim()}><ArrowRight /></Button>
      </form>}
      <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" disabled={!canSend || busy} onClick={() => respond("", true)}>I’m not sure</Button><Button variant="ghost" size="sm" disabled={!canSend || busy} onClick={() => respond("", true)}>Skip for now</Button></div>
    </div>}
    {!field && <p className="text-sm text-muted-foreground">Your available answers are recorded. You can fill any gaps when reviewing your case.</p>}
    <Button variant="secondary" disabled={busy} aria-expanded={review} onClick={() => setReview(!review)}><FileText />{review ? "Hide case summary" : "Review case summary"}</Button>
    {review && <div className="space-y-5">
      <h2 className="text-xl font-semibold">Your case summary</h2>
      <p className="text-sm text-muted-foreground">Confirmed means you reported or reviewed it, not independently proven. Landlord explanations are reported allegations.</p>
      {DEPOSIT_FIELDS.map(key => { const item = memory.fields[key]; const def = DEPOSIT_WORKFLOW[key]; return <div key={key} className="space-y-1 border-b border-border pb-3">
        <div className="flex flex-wrap justify-between gap-2"><label htmlFor={`review-${key}`} className="text-sm font-medium">{def.label}</label><span className="text-xs text-muted-foreground">{item?.status ?? "missing"}{item?.skipped ? " · skipped" : ""}</span></div>
        {def.type === "choice" ? <select id={`review-${key}`} className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={item?.value ?? ""} disabled={busy} onChange={e => onEdit(key, e.target.value, !e.target.value)}><option value="">Not sure / missing</option>{def.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> : <Input id={`review-${key}`} type={def.type === "date" ? "date" : def.type === "amount" ? "number" : "text"} step={def.type === "amount" ? "0.01" : undefined} defaultValue={item?.value ?? ""} key={`${key}-${item?.value}`} disabled={busy} onBlur={e => { if (e.target.value !== (item?.value ?? "")) onEdit(key, e.target.value, !e.target.value); }} />}
        {item?.source && <p className="break-words text-xs text-muted-foreground">{item.source}</p>}
        {item?.status === "inferred" && <Button variant="ghost" size="sm" disabled={busy} onClick={() => onEdit(key, item.value)}><Check />Confirm extracted detail</Button>}
        {item?.status === "conflicting" && <div className="flex flex-wrap gap-2">{item.alternatives.map(v => <Button key={v} variant="outline" size="sm" disabled={busy} onClick={() => onEdit(key, v)}><Pencil />Use {v}</Button>)}</div>}
      </div>; })}
      <h3 className="font-medium">Chronology</h3>
      {(["tenancyStart", "moveOutDate", "tenancyEnd"] as const).filter(key => memory.fields[key]?.value).sort((a,b) => (memory.fields[a]?.value ?? "").localeCompare(memory.fields[b]?.value ?? "")).map(key => <p key={key} className="text-sm">{memory.fields[key]?.value} · {DEPOSIT_WORKFLOW[key].label} · {memory.fields[key]?.status}</p>)}
      <h3 className="font-medium">Potential issues to check</h3>
      <p className="text-sm text-muted-foreground">Compare the landlord’s stated reason with your evidence. Any AI interpretation needs review; no legal conclusion has been made.</p>
      <h3 className="font-medium">Suggested next steps</h3>
      <p className="text-sm text-muted-foreground">Confirm the summary, gather available documents, then review them on your dashboard. Official legal guidance remains separate below.</p>
      {problems.map(p => <p role="alert" key={p} className="text-sm text-destructive">{p}</p>)}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed && reviewVersion === version} onChange={e => { setReviewed(e.target.checked); setReviewVersion(version); }} />I have checked the facts and understand any remaining gaps.</label>
      <Button disabled={busy || !reviewed || reviewVersion !== version || problems.length > 0} onClick={onSave}><Check />Confirm and open dashboard</Button>
    </div>}
  </div>;
}