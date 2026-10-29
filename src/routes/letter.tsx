import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, WithCase } from "@/components/case-ui";
import { useCase } from "@/lib/case-store";
import { buildLetter } from "@/lib/case";

export const Route = createFileRoute("/letter")({
  head: () => ({
    meta: [
      { title: "Draft letter — RentResolve" },
      { name: "description", content: "An editable email to your landlord or agent about a deposit deduction, ready to copy." },
      { property: "og:title", content: "Draft letter — RentResolve" },
      { property: "og:description", content: "Edit and copy a polite deposit dispute email." },
    ],
  }),
  component: Letter,
});

function Letter() {
  const { update } = useCase();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2500);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <PageHeader eyebrow="Draft letter" title="Your email to the landlord"
        intro="Built from a template using your case details. Read it carefully and change anything that isn't accurate before sending." />
      <WithCase>
        {(c) => (
          <div className="card-soft p-4 md:p-6">
            <Textarea aria-label="Draft email" rows={22} className="font-sans text-base leading-relaxed" value={c.letter}
              onChange={(e) => update({ letter: e.target.value })} />
            {!c.letter.trim() && <p className="mt-2 text-sm text-muted-foreground">The draft is empty — rebuild it from your case details.</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => copy(c.letter)} disabled={!c.letter.trim()}>
                {status === "copied" ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy email</>}
              </Button>
              <Button variant="outline" onClick={() => { if (confirm("Replace your edits with a fresh draft?")) update({ letter: buildLetter(c) }); }}>
                <RefreshCw className="h-4 w-4" /> Rebuild from case
              </Button>
              {status === "error" && <p role="alert" className="text-sm text-destructive">Couldn't copy automatically — select the text and copy it manually.</p>}
            </div>
          </div>
        )}
      </WithCase>
    </div>
  );
}
