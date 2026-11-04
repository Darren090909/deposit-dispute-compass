import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList, FileSearch, Mail, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCase } from "@/lib/case-store";
import terrace from "@/assets/terrace.jpg";
import door from "@/assets/door.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RentResolve — Your tenancy dispute, made clearer" },
      { name: "description", content: "A calm, step-by-step guide for students and private renters in England disputing a deposit deduction." },
      { property: "og:title", content: "RentResolve — Your tenancy dispute, made clearer" },
      { property: "og:description", content: "Organise your evidence, understand the deposit dispute process and draft a clear email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STEPS = [
  { icon: ClipboardList, title: "Tell us what happened", text: "A few plain questions about your deposit and documents." },
  { icon: FileSearch, title: "See your evidence clearly", text: "What supports you, and what's still missing." },
  { icon: Scale, title: "Understand your options", text: "The official deposit dispute routes, with source links." },
  { icon: Mail, title: "Send a clear email", text: "An editable draft you can copy and send." },
];

function Index() {
  const { loadSample } = useCase();
  const navigate = useNavigate();
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:px-6 md:py-20">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">For students & private renters in England</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Your tenancy dispute, made clearer.</h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Landlord keeping part of your deposit? RentResolve helps you organise the facts, see what evidence you have, and
            take the next step calmly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/intake">Start my own case</Link>
            </Button>
            <Button size="lg" variant="outline" onClick={() => { loadSample(); navigate({ to: "/dashboard" }); }}>
              Try a sample case
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Free · no account · saved only on this device</p>
        </div>
        <div className="relative">
          <img src={terrace} alt="A row of red-brick Victorian terraced houses in an English town" width={1600} height={1008}
            className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card" />
          <div className="card-soft absolute -bottom-6 left-4 right-4 p-4 md:left-auto md:right-6 md:w-72">
            <p className="text-xs text-muted-foreground">Sample case</p>
            <p className="font-semibold">£1,200 carpet deduction</p>
            <p className="text-sm text-muted-foreground">from an £1,800 deposit</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h2 className="text-2xl font-semibold md:text-3xl">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card-soft p-6">
              <s.icon className="h-6 w-6 text-accent" aria-hidden />
              <p className="mt-4 text-sm text-muted-foreground">Step {i + 1}</p>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[1fr_1.2fr] md:px-6">
        <img src={door} alt="Front door and bay window of a rented Edwardian house" width={1024} height={1024} loading="lazy"
          className="aspect-square w-full rounded-3xl object-cover" />
        <div>
          <h2 className="text-2xl font-semibold md:text-3xl">Plain language, honest limits</h2>
          <p className="mt-4 text-muted-foreground">
            In England, most deposits for assured shorthold tenancies must be protected in a government-approved scheme, and
            each scheme offers free dispute resolution. RentResolve explains these steps in everyday words and links to the
            official sources.
          </p>
          <p className="mt-4 text-muted-foreground">
            Everything we organise for you is a starting point you can edit. We don't decide who is right — and this prototype
            does not use a live AI model.
          </p>
        </div>
      </section>
    </>
  );
}
