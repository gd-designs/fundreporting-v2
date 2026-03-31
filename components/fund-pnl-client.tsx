"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { Spinner } from "@/components/ui/spinner"

// ─── Types ────────────────────────────────────────────────────────────────────

type FundPeriod = {
  id: string
  label?: string | null
  status?: "open" | "closed" | null
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
  amount_invested?: number | null
  amount_returned?: number | null
  amount_distributed?: number | null
  shares_issued?: number | null
  shares_redeemed?: number | null
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
  if (!ts) return null
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function periodLabel(p: FundPeriod, idx: number) {
  return p.label ?? `Period ${idx + 1}`
}

/** Gross income = value the fund created before management fees */
function grossIncome(p: FundPeriod): number | null {
  if (p.nav_gross_end == null || p.nav_start == null || p.total_shares_start == null) return null
  return (p.nav_gross_end - p.nav_start) * p.total_shares_start
}

/** Net income = value after management fees */
function netIncome(p: FundPeriod): number | null {
  if (p.nav_end == null || p.nav_start == null || p.total_shares_start == null) return null
  return (p.nav_end - p.nav_start) * p.total_shares_start
}

// ─── P&L Statement Line ───────────────────────────────────────────────────────

function StatementLine({
  label,
  value,
  code,
  indent = false,
  bold = false,
  separator = false,
  colorize = false,
  muted = false,
}: {
  label: string
  value: number | null
  code: string
  indent?: boolean
  bold?: boolean
  separator?: boolean
  colorize?: boolean
  muted?: boolean
}) {
  const formatted = fmtCcy(value, code)
  const positive = value != null && value >= 0
  const valueColor = colorize
    ? value == null ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-red-600"
    : muted ? "text-muted-foreground" : "text-foreground"

  return (
    <div className={`flex items-center justify-between py-2 ${separator ? "border-t mt-1" : "border-b border-border/40"} ${bold ? "font-semibold" : ""}`}>
      <span className={`text-sm ${indent ? "pl-4 text-muted-foreground" : ""} ${bold ? "text-foreground" : ""}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums font-medium ${valueColor}`}>
        {formatted}
      </span>
    </div>
  )
}

function SectionHeader({ label, color = "bg-slate-700" }: { label: string; color?: string }) {
  return (
    <div className={`px-3 py-1 rounded text-[10px] font-bold tracking-widest text-white uppercase mt-4 mb-1 ${color}`}>
      {label}
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-1 bg-card">
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

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | "all">("all")

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

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    )
  }

  const closedPeriods = periods.filter((p) => p.status === "closed")

  if (closedPeriods.length === 0) {
    return (
      <div className="p-6 md:p-8 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Loss</h1>
          <p className="text-sm text-muted-foreground mt-1">No closed periods yet. Close your first period in the NAV Manager to generate a P&amp;L statement.</p>
        </div>
        <div className="rounded-xl border border-dashed p-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <BarChart3 className="size-8 opacity-40" />
          <p className="text-sm">P&amp;L statement will appear here once periods are closed.</p>
        </div>
      </div>
    )
  }

  // ── Selected period(s) ──────────────────────────────────────────────────────
  const displayPeriods = selectedPeriodId === "all" ? closedPeriods : closedPeriods.filter((p) => p.id === selectedPeriodId)

  // ── Aggregate across display periods ────────────────────────────────────────
  const mutsByPeriod = new Map<string, FundMutation[]>()
  for (const m of mutations) {
    if (!m.period) continue
    const arr = mutsByPeriod.get(m.period) ?? []
    arr.push(m)
    mutsByPeriod.set(m.period, arr)
  }

  // Aggregate P&L line items
  let aggGrossIncome = 0
  let aggMgmtFees = 0
  let aggPnlCosts = 0
  let aggNetIncome = 0
  let allNull = true

  for (const p of displayPeriods) {
    const gi = grossIncome(p)
    const ni = netIncome(p)
    if (gi != null) { aggGrossIncome += gi; allNull = false }
    if (ni != null) { aggNetIncome += ni; allNull = false }
    aggMgmtFees += p.management_fee_total ?? 0
    aggPnlCosts += p.pnl_costs ?? 0
  }

  const aggGrossProfit = aggGrossIncome // No COGS tracked yet
  const aggOperatingExpenses = aggMgmtFees + aggPnlCosts
  const aggOperatingIncome = aggGrossProfit - aggOperatingExpenses

  // Mutations aggregate for context
  const aggSubs = displayPeriods.reduce((s, p) => {
    return s + (mutsByPeriod.get(p.id) ?? [])
      .filter((m) => m.type === "subscription")
      .reduce((ms, m) => ms + (m.amount_invested ?? 0), 0)
  }, 0)
  const aggRedems = displayPeriods.reduce((s, p) => {
    return s + (mutsByPeriod.get(p.id) ?? [])
      .filter((m) => m.type === "redemption")
      .reduce((ms, m) => ms + (m.amount_returned ?? 0), 0)
  }, 0)
  const aggDists = displayPeriods.reduce((s, p) => {
    return s + (mutsByPeriod.get(p.id) ?? [])
      .filter((m) => m.type === "distribution")
      .reduce((ms, m) => ms + (m.amount_distributed ?? 0), 0)
  }, 0)

  // Compound return across display periods
  const compoundReturn = displayPeriods.reduce((acc, p) => {
    if (p.yield_net == null) return acc
    return acc * (1 + p.yield_net)
  }, 1) - 1

  // ── Chart data ───────────────────────────────────────────────────────────────
  const chartData = closedPeriods.map((p, i) => {
    const gi = grossIncome(p)
    const ni = netIncome(p)
    return {
      name: periodLabel(p, i),
      "Gross income": gi != null ? Math.round(gi) : null,
      "Net income": ni != null ? Math.round(ni) : null,
      "Operating expenses": -(p.management_fee_total ?? 0) - (p.pnl_costs ?? 0),
    }
  })

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Loss</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {closedPeriods.length} closed period{closedPeriods.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Period selector */}
        <select
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">All periods</option>
          {closedPeriods.map((p, i) => (
            <option key={p.id} value={p.id}>{periodLabel(p, i)}</option>
          ))}
        </select>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Gross income"
          value={allNull ? "—" : fmtCcy(aggGrossIncome, currencyCode)}
          sub="Portfolio value appreciation"
          positive={!allNull ? aggGrossIncome >= 0 : null}
        />
        <SummaryCard
          label="Operating expenses"
          value={fmtCcy(aggOperatingExpenses, currencyCode)}
          sub={aggMgmtFees > 0 ? `${fmtCcy(aggMgmtFees, currencyCode)} mgmt fees` : undefined}
          positive={false}
        />
        <SummaryCard
          label="Net income"
          value={allNull ? "—" : fmtCcy(aggNetIncome, currencyCode)}
          sub={`Net return: ${fmtPct(compoundReturn)}`}
          positive={!allNull ? aggNetIncome >= 0 : null}
        />
        <SummaryCard
          label="Distributions paid"
          value={aggDists > 0 ? fmtCcy(aggDists, currencyCode) : "—"}
          sub={aggSubs > 0 ? `${fmtCcy(aggSubs, currencyCode)} subscribed` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

        {/* ── P&L Statement ── */}
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b">
            <p className="font-semibold text-sm">Profit &amp; Loss Statement</p>
            {selectedPeriodId !== "all" && (() => {
              const p = closedPeriods.find((x) => x.id === selectedPeriodId)
              if (!p) return null
              const from = fmtDate(p.opened_at)
              const to = fmtDate(p.closed_at)
              return <p className="text-xs text-muted-foreground mt-0.5">{from}{to ? ` → ${to}` : ""}</p>
            })()}
          </div>

          <div className="px-5 py-4">
            {/* ── INCOME ── */}
            <SectionHeader label="Income" color="bg-emerald-700" />

            <StatementLine
              label="Portfolio income (value appreciation)"
              value={allNull ? null : aggGrossIncome}
              code={currencyCode}
              indent
              colorize
            />
            <StatementLine
              label="Other income"
              value={null}
              code={currencyCode}
              indent
              muted
            />

            <StatementLine
              label="Gross Revenue"
              value={allNull ? null : aggGrossIncome}
              code={currencyCode}
              bold
              separator
              colorize
            />

            {/* ── COST OF INCOME ── */}
            <SectionHeader label="Cost of Income" color="bg-orange-700" />

            <StatementLine
              label="Direct asset costs"
              value={null}
              code={currencyCode}
              indent
              muted
            />

            <StatementLine
              label="Cost of Income"
              value={0}
              code={currencyCode}
              bold
              separator
              muted
            />

            {/* ── GROSS PROFIT ── */}
            <StatementLine
              label="Gross Profit"
              value={allNull ? null : aggGrossProfit}
              code={currencyCode}
              bold
              separator
              colorize
            />

            {/* ── OPERATING EXPENSES ── */}
            <SectionHeader label="Operating Expenses" color="bg-red-700" />

            <StatementLine
              label="Management fees"
              value={aggMgmtFees > 0 ? -aggMgmtFees : null}
              code={currencyCode}
              indent
              colorize
            />
            <StatementLine
              label="Fund costs &amp; expenses"
              value={aggPnlCosts > 0 ? -aggPnlCosts : null}
              code={currencyCode}
              indent
              colorize
            />
            <StatementLine
              label="Personnel &amp; other costs"
              value={null}
              code={currencyCode}
              indent
              muted
            />

            <StatementLine
              label="Total Operating Expenses"
              value={aggOperatingExpenses > 0 ? -aggOperatingExpenses : null}
              code={currencyCode}
              bold
              separator
              colorize
            />

            {/* ── OPERATING INCOME ── */}
            <StatementLine
              label="Operating Income"
              value={allNull ? null : aggOperatingIncome}
              code={currencyCode}
              bold
              separator
              colorize
            />

            {/* ── FINANCIAL INCOME & EXPENSES ── */}
            <SectionHeader label="Financial Income &amp; Expenses" color="bg-blue-700" />

            <StatementLine
              label="Interest income"
              value={null}
              code={currencyCode}
              indent
              muted
            />
            <StatementLine
              label="Interest expense"
              value={null}
              code={currencyCode}
              indent
              muted
            />

            <StatementLine
              label="Net Financial Items"
              value={null}
              code={currencyCode}
              bold
              separator
              muted
            />

            {/* ── NET INCOME ── */}
            <div className="mt-3 pt-3 border-t-2 border-foreground/20 flex items-center justify-between">
              <span className="font-bold text-base">Net Income</span>
              <span className={`font-bold text-base tabular-nums ${!allNull ? (aggNetIncome >= 0 ? "text-emerald-600" : "text-red-600") : "text-muted-foreground"}`}>
                {allNull ? "—" : fmtCcy(aggNetIncome, currencyCode)}
              </span>
            </div>

            {/* ── Capital flows note ── */}
            {(aggSubs > 0 || aggRedems > 0 || aggDists > 0) && (
              <div className="mt-5 pt-4 border-t border-dashed flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Capital flows (not income)</p>
                {aggSubs > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subscriptions received</span>
                    <span className="tabular-nums text-emerald-600 font-medium">{fmtCcy(aggSubs, currencyCode)}</span>
                  </div>
                )}
                {aggRedems > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Redemptions paid</span>
                    <span className="tabular-nums text-red-600 font-medium">−{fmtCcy(aggRedems, currencyCode)}</span>
                  </div>
                )}
                {aggDists > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Distributions paid</span>
                    <span className="tabular-nums text-red-600 font-medium">−{fmtCcy(aggDists, currencyCode)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: chart + period breakdown ── */}
        <div className="flex flex-col gap-4">

          {/* Income chart */}
          {chartData.some((d) => d["Gross income"] != null) && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Income by period</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtCcy(v, currencyCode)} width={64} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmtCcy(v, currencyCode), name]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="Gross income" fill="hsl(142 76% 36%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Net income" fill="hsl(221 83% 53%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Period summary table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-semibold">By period</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Period</th>
                  <th className="text-right px-4 py-2 font-medium">Gross</th>
                  <th className="text-right px-4 py-2 font-medium">Fees</th>
                  <th className="text-right px-4 py-2 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {closedPeriods.map((p, i) => {
                  const gi = grossIncome(p)
                  const ni = netIncome(p)
                  return (
                    <tr
                      key={p.id}
                      className={`border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors ${selectedPeriodId === p.id ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedPeriodId(selectedPeriodId === p.id ? "all" : p.id)}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{periodLabel(p, i)}</p>
                        <p className="text-muted-foreground text-[10px]">
                          {fmtDate(p.opened_at)}{p.closed_at ? ` → ${fmtDate(p.closed_at)}` : ""}
                        </p>
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${gi != null ? (gi >= 0 ? "text-emerald-600" : "text-red-600") : "text-muted-foreground"}`}>
                        {fmtCcy(gi, currencyCode)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {fmtCcy(p.management_fee_total, currencyCode)}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${ni != null ? (ni >= 0 ? "text-emerald-600" : "text-red-600") : "text-muted-foreground"}`}>
                        {fmtCcy(ni, currencyCode)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {closedPeriods.length > 1 && (
                <tfoot>
                  <tr className="bg-muted/20 border-t font-semibold">
                    <td className="px-4 py-2.5 text-muted-foreground">Total</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${aggGrossIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {allNull ? "—" : fmtCcy(aggGrossIncome, currencyCode)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmtCcy(aggMgmtFees, currencyCode)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${aggNetIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {allNull ? "—" : fmtCcy(aggNetIncome, currencyCode)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
