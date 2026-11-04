import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";

const NAV = [
  { to: "/intake", label: "Start" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/evidence", label: "Evidence" },
  { to: "/analysis", label: "AI analysis" },
  { to: "/options", label: "Options" },
  { to: "/letter", label: "Draft letter" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Scale className="h-4 w-4" aria-hidden />
          </span>
          RentResolve
        </Link>
        <nav aria-label="Main" className="-mx-1 flex w-full gap-1 overflow-x-auto md:ml-auto md:w-auto">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-secondary text-secondary-foreground font-semibold" }}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground md:px-6">
        <p className="font-semibold text-foreground">Important</p>
        <p className="mt-1 max-w-3xl">
          RentResolve provides general information about tenancy deposits in England. It is not a determination of your
          legal rights and is not a substitute for professional advice. For advice on your situation, contact{" "}
          <a className="underline" href="https://www.citizensadvice.org.uk/" target="_blank" rel="noreferrer">Citizens Advice</a>,{" "}
          <a className="underline" href="https://england.shelter.org.uk/" target="_blank" rel="noreferrer">Shelter</a> or your
          students' union advice centre.
        </p>
        <p className="mt-4">A three-day student prototype. Sample data is fictional. Your case is saved only in this browser.</p>
      </div>
    </footer>
  );
}
