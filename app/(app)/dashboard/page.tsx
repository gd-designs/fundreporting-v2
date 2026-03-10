import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Building2,
  FileText,
  Landmark,
  ListTodo,
  Plus,
  Users,
  BarChart3,
  Wallet,
  Send,
} from "lucide-react";
import { AddEntityDialog } from "@/components/add-entity-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEntities } from "@/lib/entities";
import { buildDashboardSnapshot } from "@/lib/dashboard";
import type { UnifiedEntity } from "@/lib/types";

type MyCapitalCall = {
  id: string
  amount: number | null
  due_date: number | null
  status: "pending" | "partial" | "paid" | null
  acknowledged_at: number | null
  entity_name: string | null
  currency: { code: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
}

function formatCurrency(value: number, code = "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
}

function typeLabel(entity: UnifiedEntity) {
  const labels: Record<UnifiedEntity["type"], string> = {
    portfolio: "Portfolio",
    company: "Company",
    family_office: "Family Office",
    asset_manager: "Asset Manager",
    fund: "Fund",
  };
  return labels[entity.type];
}

function EntityIcon({ type }: { type: UnifiedEntity["type"] }) {
  const icons: Record<UnifiedEntity["type"], React.ElementType> = {
    portfolio: Landmark,
    fund: Landmark,
    company: Building2,
    family_office: Users,
    asset_manager: BarChart3,
  };
  const Icon = icons[type];
  return <Icon className="size-4" />;
}

export default async function DashboardPage() {
  const entities = await getEntities();
  const token = (await cookies()).get("authToken")?.value;

  // Fetch capital calls for this user (investor view)
  let capitalCalls: MyCapitalCall[] = []
  if (token) {
    try {
      const ccRes = await fetch(`${process.env.PLATFORM_API_URL}/my-capital-calls`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (ccRes.ok) {
        const data = await ccRes.json()
        capitalCalls = Array.isArray(data) ? data : []
      }
    } catch { /* ignore */ }
  }
  const pendingCalls = capitalCalls.filter((c) => !c.acknowledged_at && c.status !== "paid")

  const snapshot = token
    ? await buildDashboardSnapshot(token, entities)
    : {
        entitySnapshots: [],
        tasks: [],
        documents: [],
        totals: {
          entities: 0,
          portfolios: 0,
          companies: 0,
          assetsValue: 0,
          liabilitiesValue: 0,
          netValue: 0,
          openTasks: 0,
          documents: 0,
        },
      };

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex w-full flex-col gap-6">

        {entities.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Welcome — let&apos;s get you set up</CardTitle>
              <CardDescription>
                Follow these three steps to start tracking your investments and responding to capital calls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-4 md:grid-cols-3">
                <li className="flex gap-4 rounded-lg border bg-muted/30 p-4">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                    1
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Landmark className="size-4 text-muted-foreground" />
                      <p className="font-medium text-sm">Create a portfolio</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      A portfolio is your top-level financial container — think of it as your personal balance sheet. Everything you own, invest in, or pay from lives inside a portfolio.
                    </p>
                    <AddEntityDialog >
                      <Button size="sm" className="mt-2">
                        <Plus className="size-3.5" />
                        Create portfolio
                      </Button>
                    </AddEntityDialog>
                  </div>
                </li>

                <li className="flex gap-4 rounded-lg border p-4 opacity-60">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
                    2
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="size-4 text-muted-foreground" />
                      <p className="font-medium text-sm">Add a cash asset</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Inside your portfolio, add a cash asset (e.g. a bank account). This is the source of funds you&apos;ll use to pay capital calls and record investments.
                    </p>
                  </div>
                </li>

                <li className="flex gap-4 rounded-lg border p-4 opacity-60">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
                    3
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Send className="size-4 text-muted-foreground" />
                      <p className="font-medium text-sm">Record a payment</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      When a capital call arrives, click &quot;Send Payment&quot;, select your portfolio and cash asset, and the platform records the outflow and creates your equity stake automatically.
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Workspace Overview</CardTitle>
              <CardDescription>
                Quick look across your entities, assets, tasks, and documents.
              </CardDescription>
            </div>
            <AddEntityDialog >
              <Button size="sm">
                <Plus />
                Add entity
              </Button>
            </AddEntityDialog>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Total entities
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {snapshot.totals.entities}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {snapshot.totals.portfolios} portfolios ·{" "}
                {snapshot.totals.companies} companies
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Total net value
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCurrency(snapshot.totals.netValue)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Assets {formatCurrency(snapshot.totals.assetsValue)} ·
                Liabilities {formatCurrency(snapshot.totals.liabilitiesValue)}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Open tasks
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {snapshot.totals.openTasks}
              </p>
              <Button
                asChild
                variant="link"
                className="mt-1 h-auto px-0 text-xs"
              >
                <Link href="/tasks">Open task center</Link>
              </Button>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Documents
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {snapshot.totals.documents}
              </p>
              <Button
                asChild
                variant="link"
                className="mt-1 h-auto px-0 text-xs"
              >
                <Link href="/documents">Open document center</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Entity quick look</CardTitle>
              <CardDescription>
                Snapshot of each entity with key operating numbers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {snapshot.entitySnapshots.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-sm">
                  <p>No entities yet.</p>
                  <AddEntityDialog >
                    <Button variant="outline" size="sm">
                      <Plus />
                      Add your first entity
                    </Button>
                  </AddEntityDialog>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {snapshot.entitySnapshots.map((row) => (
                    <Link
                      key={row.entity.id}
                      href={row.href}
                      className="hover:bg-muted/40 block rounded-lg border p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <div className="bg-muted text-muted-foreground rounded-md p-1.5">
                            <EntityIcon type={row.entity.type} />
                          </div>
                          <div>
                            <p className="font-medium">
                              {row.entity.name ?? "—"}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {typeLabel(row.entity)}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border px-2 py-1.5">
                          <p className="text-muted-foreground text-[11px] uppercase">
                            Net value
                          </p>
                          <p className="font-medium">
                            {formatCurrency(row.netValue)}
                          </p>
                        </div>
                        <div className="rounded-md border px-2 py-1.5">
                          <p className="text-muted-foreground text-[11px] uppercase">
                            Assets
                          </p>
                          <p className="font-medium">{row.assetsCount}</p>
                        </div>
                        <div className="rounded-md border px-2 py-1.5">
                          <p className="text-muted-foreground text-[11px] uppercase">
                            Debts
                          </p>
                          <p className="font-medium">
                            {formatCurrency(row.liabilitiesValue)}
                          </p>
                        </div>
                        <div className="rounded-md border px-2 py-1.5">
                          <p className="text-muted-foreground text-[11px] uppercase">
                            Open tasks
                          </p>
                          <p className="font-medium">{row.tasksOpen}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            {capitalCalls.length > 0 && (
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base">Capital Calls</CardTitle>
                  <Button asChild variant="link" className="h-auto px-0 text-xs">
                    <Link href="/my-capital-calls">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingCalls.length === 0 ? (
                    <p className="text-muted-foreground text-sm">All caught up.</p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {pendingCalls.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {c.entity_name ?? "—"}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {c.amount != null
                                ? new Intl.NumberFormat("en-GB", { style: "currency", currency: c.currency?.code ?? "EUR" }).format(c.amount)
                                : "—"}
                              {c.due_date ? ` · Due ${new Date(c.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                            </p>
                          </div>
                          <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status ?? "pending"]}`}>
                            {c.status ?? "pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/my-capital-calls">View all capital calls</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tasks quick look</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">No open tasks.</p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/tasks">
                    <ListTodo />
                    View all tasks
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  No documents uploaded yet.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/documents">
                    <FileText />
                    View all documents
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
