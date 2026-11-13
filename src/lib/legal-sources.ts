/**
 * Verified public guidance sources. This is the ONLY list the AI may cite for
 * procedural explanations. Maintained by hand — check each link before adding.
 * Review dates apply to the linked guidance, not to legal advice or document authenticity.
 */
export const LEGAL_SOURCES = [
  {
    id: "govuk-deposit-protection",
    title: "GOV.UK — Tenancy deposit protection",
    url: "https://www.gov.uk/tenancy-deposit-protection",
    lastReviewed: "2026-11-13",
    covers: "GOV.UK says deposits for assured periodic tenancies must be protected in a government-approved scheme within 30 days of receipt. Assured periodic tenancies replaced assured shorthold tenancies on 1 May 2026. Check the guidance for your tenancy type and circumstances.",
  },
  {
    id: "dps",
    title: "Deposit Protection Service (DPS)",
    url: "https://www.depositprotection.com/",
    covers: "Government-approved scheme; offers free alternative dispute resolution for deposits it protects.",
  },
  {
    id: "mydeposits",
    title: "mydeposits",
    url: "https://www.mydeposits.co.uk/",
    covers: "Government-approved scheme; offers free dispute resolution for deposits it protects.",
  },
  {
    id: "tds",
    title: "Tenancy Deposit Scheme (TDS)",
    url: "https://www.tenancydepositscheme.com/",
    covers: "Government-approved scheme; offers free dispute resolution for deposits it protects.",
  },
  {
    id: "citizens-advice-deposit",
    title: "Citizens Advice — Getting your deposit back",
    url: "https://www.citizensadvice.org.uk/housing/renting-privately/ending-your-tenancy/getting-your-deposit-back/",
    covers: "Practical steps for tenants: asking for the deposit back, negotiating deductions, fair wear and tear, using the scheme's dispute service.",
  },
  {
    id: "shelter-deposits",
    title: "Shelter England — Tenancy deposits",
    url: "https://england.shelter.org.uk/housing_advice/tenancy_deposits",
    covers: "Tenant guidance on deposit protection, deductions and disputes in England.",
  },
  {
    id: "govuk-money-claim",
    title: "GOV.UK — Make a court claim for money",
    url: "https://www.gov.uk/make-court-claim-for-money",
    covers: "How to make a small claim in the county court, including fees.",
  },
] as const;

export type LegalSourceId = (typeof LEGAL_SOURCES)[number]["id"];
export const LEGAL_SOURCE_IDS = LEGAL_SOURCES.map((s) => s.id) as [LegalSourceId, ...LegalSourceId[]];
export const getSource = (id: string) => LEGAL_SOURCES.find((s) => s.id === id);

/** Never display a model's explanation as if the linked publisher endorsed it. */
export function sourceControlledNotes(notes: { sourceId: string }[]) {
  const ids = new Set(notes.map(note => note.sourceId));
  return LEGAL_SOURCES.filter(source => ids.has(source.id) && "lastReviewed" in source)
    .map(source => ({ sourceId: source.id, explanation: source.covers }));
}

export function sourceReviewDate(id: string): string | null {
  const source = getSource(id);
  return source && "lastReviewed" in source ? source.lastReviewed : null;
}
