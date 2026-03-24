"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

// ─── Types ───────────────────────────────────────────────────────────────────

type FundPeriod = {
  id: string
  status?: "open" | "closed" | null
  label?: string | null
  opened_at?: number | null
  closed_at?: number | null
  nav_start?: number | null
  nav_gross_end?: number | null
  nav_end?: number | null
  total_shares_start?: number | null
  total_shares_end?: number | null
  total_aum_start?: number | null
  total_aum_end?: number | null
  total_invested_assets?: number | null
  total_debt?: number | null
  pnl_costs?: number | null
  yield_gross?: number | null
  yield_net?: number | null
  management_fee_per_share?: number | null
  management_fee_total?: number | null
  notes?: string | null
}

type FundMutation = {
  id: string
  period?: string | null
  type?: "subscription" | "redemption" | "distribution" | null
  mutation_at?: number | null
  nav_per_share?: number | null
  amount_invested?: number | null
  fee_amount?: number | null
  amount_for_shares?: number | null
  shares_issued?: number | null
  shares_redeemed?: number | null
  amount_returned?: number | null
  amount_distributed?: number | null
  notes?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCcy(n: number | null | undefined, code: string) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—"
  const pct = n * 100
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function fmtNum(n: number | null | undefined, dp = 4) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: dp }).format(n)
}

function periodLabel(p: FundPeriod, idx: number) {
  return p.label ?? `Period ${idx + 1}`
}

const MUTATION_LABELS: Record<string, string> = { subscription: "Subscription", redemption: "Redemption", distribution: "Distribution" }
const MUTATION_COLORS: Record<string, string> = {
  subscription: "bg-emerald-100 text-emerald-700",
  redemption: "bg-red-100 text-red-700",
  distribution: "bg-blue-100 text-blue-700",
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {positive != null && (
          positive
            ? <TrendingUp className="size-4 text-emerald-500 mb-0.5" />
            : <TrendingDown className="size-4 text-red-500 mb-0.5" />
        )}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Main Client Component ───────────────────────────────────────────────────

export function FundPnlClient({
  entityUUID,
  currencyCode = "EUR",
}: {
  entityUUID: string
  currencyCode?: string
}) {
  const [periods, setPeriods] = React.useState<FundPeriod[]>([])
  const [mutations, setMutations] = React.useState<FundMutation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [pRes, mRes] = await Promise.all([
          fetch(`/api/fund-periods?entity=${entityUUID}`),
          fetch(`/api/fund-mutations?entity=${entityUUID}`),
        ])
        const [pData, mData] = await Promise.all([
          pRes.ok ? pRes.json() : [],
          mRes.ok ? mRes.json() : [],
        ])
        // Sort periods by opened_at ascending
        const sorted = [...(Array.isArray(pData) ? pData : [])].sort(
          (a: FundPeriod, b: FundPeriod) => (a.opened_at ?? 0) - (b.opened_at ?? 0)
        )
        setPeriods(sorted)
        setMutations(Array.isArray(mData) ? mData : [])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [entityUUID])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Loss</h1>
        <p className="text-sm text-muted-foreground mt-2">No periods recorded yet. Open your first period in the NAV Manager.</p>
      </div>
    )
  }

  // ── Derived summary stats ──
  const closedPeriods = periods.filter((p) => p.status === "closed")
  const latestPeriod = periods[periods.length - 1]
  const currentNav = latestPeriod?.nav_end ?? latestPeriod?.nav_gross_end
  const currentShares = latestPeriod?.total_shares_end
  const currentAum = latestPeriod?.total_aum_end
  const totalMgmtFees = closedPeriods.reduce((s, p) => s + (p.management_fee_total ?? 0), 0)
  const totalCosts = closedPeriods.reduce((s, p) => s + (p.pnl_costs ?? 0), 0)

  // Compound net return across closed periods
  const compoundNetReturn = closedPeriods.reduce((acc, p) => {
    if (p.yield_net == null) return acc
    return acc * (1 + p.yield_net)
  }, 1) - 1

  // NAV chart data — one point per period
  const chartData = periods.map((p, i) => ({
    name: periodLabel(p, i),
    navPerShare: p.nav_end ?? p.nav_gross_end ?? null,
    aum: p.total_aum_end ?? null,
  }))

  // Mutations indexed by period
  const mutsByPeriod = new Map<string, FundMutation[]>()
  for (const m of mutations) {
    if (!m.period) continue
    if (!mutsByPeriod.has(m.period)) mutsByPeriod.set(m.period, [])
    mutsByPeriod.get(m.period)!.push(m)
  }

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Loss</h1>
        <p className="text-sm text-muted-foreground mt-1">{closedPeriods.length} closed period{closedPeriods.length !== 1 ? "s" : ""}</p>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="NAV / share"
          value={currentNav != null ? fmtCcy(currentNav, currencyCode) : "—"}
          sub={currentShares != null ? `${fmtNum(currentShares, 0)} shares` : undefined}
        />
        <StatCard
          label="Total AUM"
          value={fmtCcy(currentAum, currencyCode)}
          sub={latestPeriod?.status === "open" ? "Current period (open)" : "At last period close"}
        />
        <StatCard
          label="Cumulative net return"
          value={closedPeriods.length > 0 ? fmtPct(compoundNetReturn) : "—"}
          positive={closedPeriods.length > 0 ? compoundNetReturn >= 0 : null}
          sub={`Across ${closedPeriods.length} period${closedPeriods.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Total costs & fees"
          value={fmtCcy(totalMgmtFees + totalCosts, currencyCode)}
          sub={totalMgmtFees > 0 ? `${fmtCcy(totalMgmtFees, currencyCode)} mgmt fees` : undefined}
        />
      </div>

      {/* ── NAV chart ── */}
      {chartData.some((d) => d.navPerShare != null) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">NAV per share</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => fmtCcy(v, currencyCode)}
                  width={72}
                />
                <Tooltip
                  formatter={(v: number) => [fmtCcy(v, currencyCode), "NAV/share"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="navPerShare"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Period breakdown table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Period breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="w-6 py-2 px-3"></th>
                <th className="text-left py-2 px-3 font-medium">Period</th>
                <th className="text-right py-2 px-3 font-medium">AUM start</th>
                <th className="text-right py-2 px-3 font-medium">AUM end</th>
                <th className="text-right py-2 px-3 font-medium">Gross return</th>
                <th className="text-right py-2 px-3 font-medium">Mgmt fees</th>
                <th className="text-right py-2 px-3 font-medium">Costs</th>
                <th className="text-right py-2 px-3 font-medium">Net return</th>
                <th className="text-right py-2 px-3 font-medium">NAV/share end</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period, idx) => {
                const isOpen = period.status === "open"
                const isExpanded = expanded.has(period.id)
                const periodMuts = mutsByPeriod.get(period.id) ?? []
                const subsTotal = periodMuts
                  .filter((m) => m.type === "subscription")
                  .reduce((s, m) => s + (m.amount_invested ?? 0), 0)
                const redemptionsTotal = periodMuts
                  .filter((m) => m.type === "redemption")
                  .reduce((s, m) => s + (m.amount_returned ?? 0), 0)
                const distTotal = periodMuts
                  .filter((m) => m.type === "distribution")
                  .reduce((s, m) => s + (m.amount_distributed ?? 0), 0)
                const navEnd = period.nav_end ?? period.nav_gross_end

                return (
                  <React.Fragment key={period.id}>
                    <tr
                      className="border-b hover:bg-muted/30 cursor-pointer"
                      onClick={() => toggle(period.id)}
                    >
                      <td className="py-3 px-3 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium flex items-center gap-2">
                          {periodLabel(period, idx)}
                          <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {isOpen ? "Open" : "Closed"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {fmtDate(period.opened_at)}{period.closed_at ? ` → ${fmtDate(period.closed_at)}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{fmtCcy(period.total_aum_start, currencyCode)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{fmtCcy(period.total_aum_end, currencyCode)}</td>
                      <td className={`py-3 px-3 text-right tabular-nums font-medium ${period.yield_gross != null ? (period.yield_gross >= 0 ? "text-emerald-600" : "text-red-600") : ""}`}>
                        {fmtPct(period.yield_gross)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                        {period.management_fee_total != null ? fmtCcy(period.management_fee_total, currencyCode) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                        {period.pnl_costs != null ? fmtCcy(period.pnl_costs, currencyCode) : "—"}
                      </td>
                      <td className={`py-3 px-3 text-right tabular-nums font-medium ${period.yield_net != null ? (period.yield_net >= 0 ? "text-emerald-600" : "text-red-600") : ""}`}>
                        {fmtPct(period.yield_net)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-medium">{fmtCcy(navEnd, currencyCode)}</td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b bg-muted/5">
                        <td></td>
                        <td colSpan={8} className="py-3 px-3">
                          <div className="flex flex-col gap-3">

                            {/* Period detail grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {[
                                { label: "NAV start", value: fmtCcy(period.nav_start, currencyCode) },
                                { label: "NAV end (gross)", value: fmtCcy(period.nav_gross_end, currencyCode) },
                                { label: "NAV end (net)", value: fmtCcy(period.nav_end, currencyCode) },
                                { label: "Shares start", value: fmtNum(period.total_shares_start) },
                                { label: "Shares end", value: fmtNum(period.total_shares_end) },
                                { label: "Invested assets", value: fmtCcy(period.total_invested_assets, currencyCode) },
                                { label: "Total debt", value: fmtCcy(period.total_debt, currencyCode) },
                                { label: "Mgmt fee/share", value: period.management_fee_per_share != null ? fmtCcy(period.management_fee_per_share, currencyCode) : "—" },
                              ].map((item) => (
                                <div key={item.label} className="rounded-md bg-muted/40 px-3 py-2">
                                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                                  <p className="text-sm font-medium tabular-nums mt-0.5">{item.value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Capital flows */}
                            {periodMuts.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Capital flows</p>
                                <div className="flex flex-wrap gap-3 mb-2">
                                  {subsTotal > 0 && (
                                    <div className="text-xs rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                                      <span className="text-muted-foreground">Subscriptions </span>
                                      <span className="font-semibold text-emerald-700">{fmtCcy(subsTotal, currencyCode)}</span>
                                    </div>
                                  )}
                                  {redemptionsTotal > 0 && (
                                    <div className="text-xs rounded-md bg-red-50 border border-red-200 px-3 py-1.5">
                                      <span className="text-muted-foreground">Redemptions </span>
                                      <span className="font-semibold text-red-700">{fmtCcy(redemptionsTotal, currencyCode)}</span>
                                    </div>
                                  )}
                                  {distTotal > 0 && (
                                    <div className="text-xs rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5">
                                      <span className="text-muted-foreground">Distributions </span>
                                      <span className="font-semibold text-blue-700">{fmtCcy(distTotal, currencyCode)}</span>
                                    </div>
                                  )}
                                </div>
                                <table className="w-full text-xs border rounded-lg overflow-hidden">
                                  <thead>
                                    <tr className="border-b bg-muted/30 text-muted-foreground">
                                      <th className="text-left py-1.5 px-3 font-medium">Type</th>
                                      <th className="text-left py-1.5 px-3 font-medium">Date</th>
                                      <th className="text-right py-1.5 px-3 font-medium">Amount</th>
                                      <th className="text-right py-1.5 px-3 font-medium">Shares</th>
                                      <th className="text-right py-1.5 px-3 font-medium">NAV/share</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {periodMuts.map((m) => (
                                      <tr key={m.id} className="border-b last:border-0">
                                        <td className="py-1.5 px-3">
                                          <span className={`rounded-full px-1.5 py-0.5 font-medium text-[10px] ${MUTATION_COLORS[m.type ?? ""] ?? "bg-slate-100 text-slate-600"}`}>
                                            {MUTATION_LABELS[m.type ?? ""] ?? m.type}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-3 text-muted-foreground">{fmtDate(m.mutation_at)}</td>
                                        <td className="py-1.5 px-3 text-right tabular-nums">
                                          {m.type === "subscription" && fmtCcy(m.amount_invested, currencyCode)}
                                          {m.type === "redemption" && fmtCcy(m.amount_returned, currencyCode)}
                                          {m.type === "distribution" && fmtCcy(m.amount_distributed, currencyCode)}
                                        </td>
                                        <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                                          {m.type === "subscription" && fmtNum(m.shares_issued)}
                                          {m.type === "redemption" && fmtNum(m.shares_redeemed)}
                                          {m.type === "distribution" && "—"}
                                        </td>
                                        <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                                          {fmtCcy(m.nav_per_share, currencyCode)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {periodMuts.length === 0 && (
                              <p className="text-xs text-muted-foreground">No capital flows in this period.</p>
                            )}

                            {period.notes && (
                              <p className="text-xs text-muted-foreground border-l-2 pl-3 italic">{period.notes}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
            {closedPeriods.length > 1 && (
              <tfoot>
                <tr className="border-t text-xs font-medium bg-muted/10">
                  <td></td>
                  <td className="py-2 px-3 text-muted-foreground">Totals / cumulative</td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                    {fmtCcy(periods[0]?.total_aum_start, currencyCode)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {fmtCcy(latestPeriod?.total_aum_end, currencyCode)}
                  </td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                    {fmtCcy(totalMgmtFees, currencyCode)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                    {fmtCcy(totalCosts, currencyCode)}
                  </td>
                  <td className={`py-2 px-3 text-right tabular-nums font-semibold ${compoundNetReturn >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {closedPeriods.length > 0 ? fmtPct(compoundNetReturn) : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {fmtCcy(latestPeriod?.nav_end ?? latestPeriod?.nav_gross_end, currencyCode)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
