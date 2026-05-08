import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, FileText, Users, Zap, Shield, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledgerly — Modern CRM & Invoicing" },
      { name: "description", content: "Manage customers, generate professional invoices, and track revenue in one clean dashboard." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">Ledgerly</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth" search={{ mode: "signup" }}><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Built for small teams
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            CRM and invoicing,<br />
            <span className="text-primary">beautifully simple.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Manage customers, send professional PDF invoices, and track every dollar — all from a clean, fast dashboard.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="gap-2">Start free <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
          </div>
        </div>

        {/* Preview card */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="rounded-xl border border-border bg-card p-2 shadow-2xl shadow-primary/5">
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Total Revenue", v: "$48,290.00", t: "+12.4%" },
                  { label: "Outstanding", v: "$6,120.00", t: "8 invoices" },
                  { label: "Customers", v: "127", t: "+9 this month" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="mt-1 text-2xl font-semibold">{s.v}</div>
                    <div className="mt-1 text-xs text-success">{s.t}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                {["Acme Inc — INV-00012 — $1,250.00 — Paid", "Northwind Co — INV-00011 — $890.00 — Pending", "Globex — INV-00010 — $2,400.00 — Paid"].map((r) => (
                  <div key={r} className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-sm">
                    <span className="text-foreground">{r.split(" — ")[0]}</span>
                    <span className="text-muted-foreground">{r.split(" — ").slice(1).join(" · ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Our products</h2>
            <p className="mt-3 text-muted-foreground">Everything you need to run the money side of your business.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Ledgerly CRM", price: "Free", desc: "Track customers, leads and contacts with instant search and tagging.", features: ["Unlimited contacts", "Lead pipeline", "Activity history"] },
              { name: "Ledgerly Invoicing", price: "$12/mo", desc: "Send beautiful PDF invoices with automatic numbering, taxes and reminders.", features: ["PDF generation", "Auto numbering", "Payment tracking"], highlight: true },
              { name: "Ledgerly Insights", price: "$24/mo", desc: "Real-time revenue dashboards, forecasts and customer cohort analysis.", features: ["Revenue charts", "Outstanding A/R", "Custom reports"] },
            ].map((p) => (
              <div key={p.name} className={`rounded-xl border p-6 ${p.highlight ? "border-primary bg-card shadow-lg shadow-primary/10" : "border-border bg-card"}`}>
                {p.highlight && <div className="mb-3 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Most popular</div>}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <div className="mt-2 text-3xl font-bold">{p.price}</div>
                <p className="mt-3 text-sm text-muted-foreground">{p.desc}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-foreground">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth" search={{ mode: "signup" }} className="mt-6 block">
                  <Button className="w-full" variant={p.highlight ? "default" : "outline"}>Get started</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { i: Users, t: "CRM that scales", d: "Add customers, track status from lead to active client, and search instantly." },
            { i: FileText, t: "Pro invoices", d: "Auto numbering, line items, taxes, discounts and one-click PDF download." },
            { i: BarChart3, t: "Revenue insights", d: "See sales trends, outstanding payments, and customer history in real time." },
            { i: Zap, t: "Fast filters", d: "Filter invoices by date range, customer, or status — get answers in a click." },
            { i: Shield, t: "Secure by default", d: "Multi-tenant isolation, role-based access, and per-row security on every table." },
            { i: Sparkles, t: "Configurable", d: "Pick your currency and tax label. Add your logo. It's your brand." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Ledgerly. Built with care.
      </footer>
    </div>
  );
}
