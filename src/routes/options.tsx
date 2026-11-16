import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/case-ui";
import { useCase } from "@/lib/case-store";
import { gbp } from "@/lib/case";
import { SourceSafeguards } from "@/components/source-safeguards";

export const Route = createFileRoute("/options")({
  head: () => ({
    meta: [
      { title: "Resolution options — RentResolve" },
      { name: "description", content: "How tenancy deposit disputes work in England, with links to official sources." },
      { property: "og:title", content: "Resolution options — RentResolve" },
      { property: "og:description", content: "Talk to your landlord, use your scheme's free dispute service, or get advice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Options,
});

const SCHEMES = [
  { name: "Deposit Protection Service (DPS)", url: "https://www.depositprotection.com/" },
  { name: "mydeposits", url: "https://www.mydeposits.co.uk/" },
  { name: "Tenancy Deposit Scheme (TDS)", url: "https://www.tenancydepositscheme.com/" },
];

const OPTIONS = [
  {
    n: 1, title: "Talk to your landlord or agent",
    text: "Ask for evidence of the damage and the cost, and for any undisputed amount to be returned. Many disputes settle at this stage. Keep everything in writing.",
    links: [{ label: "GOV.UK: Tenancy deposit protection", url: "https://www.gov.uk/tenancy-deposit-protection" }],
  },
  {
    n: 2, title: "Use your scheme's free dispute service",
    text: "Check your deposit scheme's dispute service, eligibility requirements and current deadlines directly. Do not assume that every scheme or protection arrangement has the same time limit.",
    links: SCHEMES.map((s) => ({ label: s.name, url: s.url })),
  },
  {
    n: 3, title: "Get free independent advice",
    text: "Your students' union advice centre, Citizens Advice or Shelter can look at your specific situation.",
    links: [
      { label: "Citizens Advice: getting your deposit back", url: "https://www.citizensadvice.org.uk/housing/renting-privately/ending-your-tenancy/getting-your-deposit-back/" },
      { label: "Shelter England: tenancy deposits", url: "https://england.shelter.org.uk/housing_advice/tenancy_deposits" },
    ],
  },
  {
    n: 4, title: "Court (usually a last resort)",
    text: "Ask an independent adviser whether a court claim is appropriate and which process applies. Fees and requirements depend on the claim; do not rely on this app to select a legal route.",
    links: [{ label: "GOV.UK: Make a court claim for money", url: "https://www.gov.uk/make-court-claim-for-money" }],
  },
];

function Options() {
  const { current } = useCase();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <PageHeader eyebrow="Resolution options" title="How deposit disputes usually work in England"
        intro="General information for private renters in England. Your tenancy type and circumstances matter." />
      <div className="mb-6"><SourceSafeguards /></div>

      {current && (
        <div className="card-soft mb-6 border-accent bg-teal-soft p-5">
          <p className="font-semibold">For your case</p>
          <p className="mt-1 text-sm">
            {current.scheme === "not-protected" || current.scheme === "unknown"
              ? "You're not sure your deposit was protected. Landlords must normally protect it within 30 days of receiving it. You can search each scheme's website with your details."
              : `Your deposit is with ${current.scheme === "DPS" ? "the DPS" : current.scheme}. You could ask them to resolve the ${gbp(current.disputedAmount)} in dispute if talking to your landlord doesn't work.`}
          </p>
        </div>
      )}

      <div className="card-soft mb-6 p-5 text-sm">
        <p className="font-semibold">Ideas adjudicators often consider</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li><strong className="text-foreground">Fair wear and tear</strong> — normal deterioration from everyday use isn't usually chargeable.</li>
          <li><strong className="text-foreground">Age and lifespan</strong> — an older item has less value left, so a full replacement cost may not be fair.</li>
          <li><strong className="text-foreground">Betterment</strong> — a landlord generally shouldn't end up better off than at the start of the tenancy.</li>
          <li><strong className="text-foreground">Evidence</strong> — the landlord usually needs to show why a deduction is justified, typically using check-in and check-out reports.</li>
        </ul>
      </div>

      <ol className="space-y-4">
        {OPTIONS.map((o) => (
          <li key={o.n} className="card-soft flex gap-4 p-6">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">{o.n}</span>
            <div>
              <h2 className="text-xl font-semibold">{o.title}</h2>
              <p className="mt-1 text-muted-foreground">{o.text}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {o.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:underline">
                      {l.label} <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex justify-end">
        <Button asChild><Link to="/letter">Next: draft letter</Link></Button>
      </div>
    </div>
  );
}
