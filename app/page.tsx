import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  Layers,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react"

export default async function RootPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("authToken")
  if (token) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center" aria-label="FundReporting home">
            <Image src="/fundreporting-logo.svg" alt="FundReporting" width={211} height={24} priority />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 pt-20 pb-24 text-center md:pt-28 md:pb-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            Built for asset managers, family offices, and private funds
          </div>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            The operating system for
            <br className="hidden md:block" /> private investment vehicles.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            Run subscriptions, redemptions, distributions, NAV cycles, and investor reporting from one
            place — with a live cap table that always reflects the truth.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link href="/signup">
                Get started free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required · Cancel anytime</p>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section className="border-t bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Everything fund operations needs, in one place.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Skip the spreadsheets and one-off scripts. FundReporting handles the full lifecycle —
                from capital call to period close.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <Card key={f.title} className="border-muted/60">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-foreground/5 text-foreground">
                      <f.icon className="size-4" />
                    </span>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Audience ─────────────────────────────────────────────────────── */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Built for the way you actually run capital.</h2>
              <p className="mt-4 text-muted-foreground">
                Whether you manage one fund or a network of vehicles, FundReporting models your entities the way they exist.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {AUDIENCES.map((a) => (
                <Card key={a.title} className="border-muted/60">
                  <CardContent className="flex flex-col gap-3 p-6">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-foreground/5">
                      <a.icon className="size-4" />
                    </span>
                    <h3 className="text-base font-semibold">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">{a.body}</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {a.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="border-t bg-foreground text-background">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Stop reconciling spreadsheets. Start running your fund.
            </h2>
            <p className="max-w-xl text-background/70">
              Set up your fund or family office in minutes. Invite your team, your investors, and your accountants when you&apos;re ready.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="gap-2">
                <Link href="/signup">
                  Create an account
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-background/30 bg-transparent text-background hover:bg-background hover:text-foreground">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-3">
            <Image src="/fundreporting-logo.svg" alt="FundReporting" width={140} height={16} className="opacity-70" />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Content ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Users,
    title: "Live cap table",
    body: "Capital calls, distributions, redemptions, and share transfers — every movement, in one timeline per investor.",
  },
  {
    icon: BarChart3,
    title: "NAV cycles",
    body: "Run period closes with automated fee calculations, share class schemes, and audit-ready snapshots.",
  },
  {
    icon: Wallet,
    title: "Multi-entity ledger",
    body: "Funds, companies, family offices, and personal portfolios — accounted for separately, reconciled together.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance-ready",
    body: "Documents linked to shareholders, transactions, and assets. Always retrievable, always auditable.",
  },
] as const

const AUDIENCES = [
  {
    icon: Layers,
    title: "Asset managers",
    body: "Run multiple funds with shared infrastructure and per-fund cap tables.",
    bullets: [
      "Per-fund NAV cycles",
      "Cross-fund investor view",
      "Capital call workflows",
    ],
  },
  {
    icon: Building2,
    title: "Family offices",
    body: "Track personal portfolios alongside company-held positions and fund stakes.",
    bullets: [
      "Personal + entity views",
      "Aggregated net worth",
      "Live equity stake values",
    ],
  },
  {
    icon: FileText,
    title: "Funds-of-funds",
    body: "Model fund-as-investor relationships natively — no double accounting.",
    bullets: [
      "Linked equity stakes",
      "Auto cash flow on payouts",
      "Inherited deployments on transfer",
    ],
  },
] as const
