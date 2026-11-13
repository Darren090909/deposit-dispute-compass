import { ShieldCheck, ExternalLink } from "lucide-react";
import { LEGAL_SOURCES, sourceReviewDate } from "@/lib/legal-sources";

export function SourceSafeguards() {
  return <section className="space-y-3 border-y border-border py-5 text-sm">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-accent" />Sources and accuracy</h2>
    <p>Legal procedure below uses maintained guidance, not AI-written explanations. A source reference confirms where to look, not that a claim is true. RentResolve cannot authenticate uploaded documents or guarantee legal accuracy.</p>
    <p className="text-muted-foreground">Review dates record checks of the linked page, not approval by a solicitor. Guidance can change. Check the original source and get independent advice on deadlines or your legal rights.</p>
    <details>
      <summary className="cursor-pointer font-semibold text-accent">Guidance source register</summary>
      <ul className="mt-3 divide-y divide-border">{LEGAL_SOURCES.map(source => <li key={source.id} className="space-y-1 py-3">
        <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline">{source.title}<ExternalLink className="h-3 w-3 shrink-0" /></a>
        <p className="text-muted-foreground">{sourceReviewDate(source.id) ? `Page checked: ${sourceReviewDate(source.id)} · England guidance` : "No recorded page review · link for independent checking only"}</p>
      </li>)}</ul>
    </details>
  </section>;
}