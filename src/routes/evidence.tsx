import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleHelp, FileText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableList, EditableText, PageHeader, WithCase } from "@/components/case-ui";
import { useCase } from "@/lib/case-store";
import type { DocStatus } from "@/lib/case";

export const Route = createFileRoute("/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence review — RentResolve" },
      { name: "description", content: "Your documents, the facts they support, and the information still missing." },
      { property: "og:title", content: "Evidence review — RentResolve" },
      { property: "og:description", content: "See which documents support your deposit dispute." },
    ],
  }),
  component: Evidence,
});

const STATUS: Record<DocStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  have: { label: "Have it", icon: CheckCircle2, cls: "text-success" },
  missing: { label: "Missing", icon: XCircle, cls: "text-destructive" },
  unsure: { label: "Not sure", icon: CircleHelp, cls: "text-warning" },
};
const ORDER: DocStatus[] = ["have", "missing", "unsure"];

function Evidence() {
  const { update } = useCase();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <PageHeader eyebrow="Evidence review" title="What you have, and what's missing"
        intro="Strong evidence usually compares the property's condition at the start and end of the tenancy." />
      <WithCase>
        {(c) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card-soft p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold">Documents</h2>
              <ul className="mt-4 divide-y divide-border">
                {c.documents.map((d) => {
                  const S = STATUS[d.status] ?? STATUS.unsure;
                  return (
                    <li key={d.key} className="grid gap-2 py-3 md:grid-cols-[1.2fr_auto_2fr] md:items-center">
                      <span className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-muted-foreground" />{d.label}</span>
                      <button type="button" title="Click to change status"
                        onClick={() => update({ documents: c.documents.map((x) => x.key === d.key ? { ...x, status: ORDER[(ORDER.indexOf(x.status) + 1) % 3] ?? "have" } : x) })}
                        className={`flex w-fit items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm ${S.cls}`}>
                        <S.icon className="h-4 w-4" /> {S.label}
                      </button>
                      <Input aria-label={`Note for ${d.label}`} placeholder="Add a note (date, what it shows)" value={d.note}
                        onChange={(e) => update({ documents: c.documents.map((x) => x.key === d.key ? { ...x, note: e.target.value } : x) })} />
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="card-soft p-6">
              <h2 className="text-xl font-semibold">Supported facts</h2>
              <p className="mb-4 text-sm text-muted-foreground">Check each one against the document named.</p>
              <div className="space-y-3">
                {c.facts.length === 0 && <p className="text-sm text-muted-foreground">No facts recorded yet.</p>}
                {c.facts.map((f, i) => (
                  <div key={i} className="rounded-lg bg-muted/60 p-3">
                    <EditableText label={`fact ${i + 1}`} value={f.text} rows={2}
                      onSave={(text) => update({ facts: text.trim() ? c.facts.map((x, j) => j === i ? { ...x, text } : x) : c.facts.filter((_, j) => j !== i) })} />
                    <p className="mt-1 text-xs text-accent">Source: {f.source}</p>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => update({ facts: [...c.facts, { text: "New fact — click the pencil to edit", source: "Added by you" }] })}>+ Add fact</Button>
              </div>
            </section>
            <section className="card-soft p-6">
              <h2 className="text-xl font-semibold">Missing information</h2>
              <p className="mb-4 text-sm text-muted-foreground">Things worth requesting or finding.</p>
              <EditableList label="Item" items={c.missing} onChange={(missing) => update({ missing })} />
            </section>
            <div className="flex justify-end lg:col-span-2">
              <Button asChild><Link to="/options">Next: resolution options</Link></Button>
            </div>
          </div>
        )}
      </WithCase>
    </div>
  );
}
