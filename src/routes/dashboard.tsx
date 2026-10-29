import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ListChecks, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableList, EditableText, PageHeader, WithCase } from "@/components/case-ui";
import { useCase } from "@/lib/case-store";
import { fmtDate, gbp, SCHEME_LABELS } from "@/lib/case";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Case dashboard — RentResolve" },
      { name: "description", content: "Your deposit dispute at a glance: summary, amount disputed, timeline and next steps." },
      { property: "og:title", content: "Case dashboard — RentResolve" },
      { property: "og:description", content: "Summary, timeline and next steps for your deposit dispute." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { update, setCase } = useCase();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <WithCase>
        {(c) => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <PageHeader eyebrow="Case dashboard" title={c.address || "Your case"} />
              <Button variant="ghost" size="sm" onClick={() => setCase(null)}><RotateCcw className="h-4 w-4" /> Close case</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Deposit paid" value={gbp(c.depositAmount)} />
              <Stat label="Amount disputed" value={gbp(c.disputedAmount)} highlight />
              <Stat label="Not in dispute" value={gbp(c.depositAmount - c.disputedAmount)} />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-6">
                <section className="card-soft p-6">
                  <h2 className="text-xl font-semibold">Summary</h2>
                  <p className="mb-3 text-sm text-muted-foreground">{SCHEME_LABELS[c.scheme]} · {c.landlordName || "Landlord not named"}</p>
                  <EditableText label="summary" value={c.summary} onSave={(summary) => update({ summary })} rows={5} />
                </section>
                <section className="card-soft p-6">
                  <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="h-5 w-5 text-accent" /> Timeline</h2>
                  {c.timeline.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Add tenancy dates to build a timeline.</p>}
                  <ol className="mt-4 space-y-3 border-l-2 border-secondary pl-5">
                    {[...c.timeline].sort((x, y) => x.date.localeCompare(y.date)).map((t, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[27px] top-2 h-3 w-3 rounded-full bg-accent" />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input type="date" aria-label="Event date" className="sm:w-40" value={t.date}
                            onChange={(e) => update({ timeline: c.timeline.map((x) => (x === t ? { ...x, date: e.target.value } : x)) })} />
                          <Input aria-label="Event description" value={t.label}
                            onChange={(e) => update({ timeline: c.timeline.map((x) => (x === t ? { ...x, label: e.target.value } : x)) })} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{fmtDate(t.date)}</p>
                      </li>
                    ))}
                  </ol>
                  <Button className="mt-4" size="sm" variant="outline"
                    onClick={() => update({ timeline: [...c.timeline, { date: new Date().toISOString().slice(0, 10), label: "New event" }] })}>+ Add event</Button>
                </section>
              </div>
              <section className="card-soft h-fit p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold"><ListChecks className="h-5 w-5 text-accent" /> Next steps</h2>
                <div className="mt-4"><EditableList label="Step" items={c.nextSteps} onChange={(nextSteps) => update({ nextSteps })} /></div>
                <div className="mt-6 grid gap-2">
                  <Button asChild variant="secondary"><Link to="/evidence">Review evidence <ArrowRight className="h-4 w-4" /></Link></Button>
                  <Button asChild variant="secondary"><Link to="/options">See resolution options <ArrowRight className="h-4 w-4" /></Link></Button>
                  <Button asChild><Link to="/letter">Open draft letter <ArrowRight className="h-4 w-4" /></Link></Button>
                </div>
              </section>
            </div>
          </>
        )}
      </WithCase>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card-soft p-5 ${highlight ? "border-accent bg-teal-soft" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-3xl font-semibold">{value}</p>
    </div>
  );
}
