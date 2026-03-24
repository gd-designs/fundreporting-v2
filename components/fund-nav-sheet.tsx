"use client"

import * as React from "react"
import { Spinner } from "@/components/ui/spinner"

// ─── Types ────────────────────────────────────────────────────────────────────

type FundMutation = {
  id: string
  period?: string | null
  type?: "subscription" | "redemption" | "distribution" | null
  nav_per_share?: number | null
  amount_for_shares?: number | null
  fee_amount?: number | null
  shares_issued?: number | null
  shares_redeemed?: number | null
  amount_returned?: number | null
  amount_distributed?: number | null
  _cap_table_entry?: {
    id: string
    _shareholder?: { id: string; name?: string | null } | null
  } | null
}

type FundPeriod = {
  id: string
  label?: string | null
  status?: "open" | "closed" | null
  opened_at?: number | null
  nav_start?: number | null
  nav_end?: number | null
  nav_gross_end?: number | null
  total_shares_start?: number | null
  total_shares_end?: number | null
  total_aum_start?: number | null
  total_aum_end?: number | null
  yield_gross?: number | null
  yield_net?: number | null
  management_fee_per_share?: number | null
  management_fee_total?: number | null
  pnl_costs?: number | null
  total_invested_assets?: number | null
  total_debt?: number | null
}

type PeriodWithMutations = FundPeriod & { mutations: FundMutation[] }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n)
}

function fmtCcy(n: number | null | undefined, code: string): string {
  if (n == null) return "—"
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(n)
  } catch {
    return String(n)
  }
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—"
  return `${(n * 100).toFixed(2)}%`
}

function colLabel(p: FundPeriod): string {
  if (p.label) return p.label
  if (p.opened_at) {
    return new Date(p.opened_at)
      .toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
      .toUpperCase()
  }
  return p.id.slice(0, 6)
}

function investorNames(mutations: FundMutation[], type: FundMutation["type"]): string {
  const names = mutations
    .filter((m) => m.type === type)
    .map((m) => m._cap_table_entry?._shareholder?.name)
    .filter((n): n is string => !!n)
  if (names.length === 0) return "—"
  return [...new Set(names)].join(", ")
}

const OPEN_CELL = <span className="text-muted-foreground text-[10px] italic">Open</span>

// ─── Row definitions ──────────────────────────────────────────────────────────

type CellValue = React.ReactNode

type MetricRow = {
  kind: "metric"
  label: string
  /** value shown in the MUTATION sub-column */
  getMutation?: (p: PeriodWithMutations, code: string) => CellValue
  /** value shown in the PERIOD sub-column */
  getPeriod?: (p: PeriodWithMutations, code: string) => CellValue
}

type SectionRow = { kind: "section"; label: string; color: string; mutActive?: boolean }
type RowDef = SectionRow | MetricRow

function buildRows(): RowDef[] {
  return [
    // ── Step A (period col only) ──────────────────────────────────────────────
    { kind: "section", label: "STEP A: DATA FROM END LAST PERIOD", color: "bg-slate-700 text-white", mutActive: false },
    {
      kind: "metric", label: "Start NAV this period",
      getPeriod: (p, code) => fmtCcy(p.nav_start, code),
    },
    {
      kind: "metric", label: "Total amount of shares outstanding beginning of the period",
      getPeriod: (p) => fmt(p.total_shares_start, 2),
    },
    {
      kind: "metric", label: "Total Assets Under Management beginning of the period",
      getPeriod: (p, code) => fmtCcy(p.total_aum_start, code),
    },

    // ── Step B (period col only) ──────────────────────────────────────────────

    { kind: "section", label: "STEP B: DATA FROM THE FINANCIALS", color: "bg-slate-700 text-white", mutActive: false },
    {
      kind: "metric", label: "BALANCE: Shares in the fund",
      getPeriod: (p) => (p.total_shares_start != null ? "Multiple assets" : "—"),
    },
    {
      kind: "metric", label: "BALANCE: Total Invested Assets end of period (cash + trades)",
      getPeriod: (p, code) => fmtCcy(p.total_invested_assets, code),
    },
    {
      kind: "metric", label: "BALANCE: Total Debt end of period",
      getPeriod: (p, code) => fmtCcy(p.total_debt, code),
    },
    {
      kind: "metric", label: "BALANCE:  Asset minus Liabilities end of period",
      getPeriod: (p, code) => {
        if (p.total_invested_assets != null && p.total_debt != null) {
          return fmtCcy(p.total_invested_assets - p.total_debt, code)
        }
        return fmtCcy(p.nav_gross_end, code)
      },
    },
    {
      kind: "metric", label: "P&L: Cost associated with the fund in period",
      getPeriod: (p, code) => (p.pnl_costs != null ? fmtCcy(p.pnl_costs, code) : "—"),
    },
    {
      kind: "metric", label: "BALANCE:  Total Assets Under Management end of period",
      getPeriod: (p, code) => {
        if (p.total_invested_assets != null && p.total_debt != null) {
          return fmtCcy(p.total_invested_assets - p.total_debt - (p.pnl_costs ?? 0), code)
        }
        return fmtCcy(p.total_aum_end, code)
      },
    },

    // ── Step C (period col only) ──────────────────────────────────────────────

    { kind: "section", label: "STEP C: NET NAV CALCULATION", color: "bg-slate-700 text-white", mutActive: false },
    {
      kind: "metric", label: "Gross end NAV for the period",
      getPeriod: (p, code) => fmtCcy(p.nav_gross_end, code),
    },
    {
      kind: "metric", label: "Gross end yield for the period",
      getPeriod: (p) => fmtPct(p.yield_gross),
    },
    {
      kind: "metric", label: "Managementfee per share over the period",
      getPeriod: (p, code) =>
        p.management_fee_per_share != null ? fmtCcy(p.management_fee_per_share, code) : "—",
    },
    {
      kind: "metric", label: "Managementfee total the period",
      getPeriod: (p, code) =>
        p.management_fee_total != null ? fmtCcy(p.management_fee_total, code) : "—",
    },
    {
      kind: "metric", label: "Net NAV end of the period",
      getPeriod: (p, code) =>
        p.nav_end != null ? fmtCcy(p.nav_end, code) : p.status === "open" ? OPEN_CELL : "—",
    },
    {
      kind: "metric", label: "Net yield for the period",
      getPeriod: (p) => fmtPct(p.yield_net),
    },
    {
      kind: "metric", label: "Total amount of shares outstanding  end of period",
      getPeriod: (p) => (p.status === "open" ? OPEN_CELL : fmt(p.total_shares_end, 2)),
    },
    {
      kind: "metric", label: "Total Assets Under Management end of period",
      getPeriod: (p, code) =>
        p.status === "open" ? OPEN_CELL : fmtCcy(p.total_aum_end, code),
    },

    // ── Step 1: Distribution (mutation col only) ──────────────────────────────

    { kind: "section", label: "STEP 1: DISTRIBUTION", color: "bg-blue-700 text-white", mutActive: true },
    {
      kind: "metric", label: "The investor(s)",
      getMutation: (p) => investorNames(p.mutations, "distribution"),
    },
    {
      kind: "metric", label: "Cash distribution (amount)",
      getMutation: (p, code) => {
        const total = p.mutations
          .filter((m) => m.type === "distribution")
          .reduce((s, m) => s + (m.amount_distributed ?? 0), 0)
        return total > 0 ? fmtCcy(total, code) : "—"
      },
    },
    {
      kind: "metric",
      label: "Total Assets Under Management end of period after distribution",
      getMutation: (p, code) => {
        const distTotal = p.mutations
          .filter((m) => m.type === "distribution")
          .reduce((s, m) => s + (m.amount_distributed ?? 0), 0)
        if (p.total_aum_end == null && distTotal === 0) return "—"
        const base = p.total_aum_end ?? 0
        return fmtCcy(base - distTotal, code)
      },
    },
    {
      kind: "metric", label: "Total amount of shares outstanding  end of period",
      getMutation: (p) => (p.status === "open" ? OPEN_CELL : fmt(p.total_shares_end, 2)),
    },

    // ── Step 2: Redemption (mutation col only) ────────────────────────────────

    { kind: "section", label: "STEP 2: REDEMPTION", color: "bg-red-700 text-white", mutActive: true },
    {
      kind: "metric", label: "The investor(s)",
      getMutation: (p) => investorNames(p.mutations, "redemption"),
    },
    {
      kind: "metric", label: "Amount asked to return by the investor (amount)",
      getMutation: (p, code) => {
        const total = p.mutations
          .filter((m) => m.type === "redemption")
          .reduce((s, m) => s + (m.amount_returned ?? 0), 0)
        return total > 0 ? fmtCcy(total, code) : "—"
      },
    },
    {
      kind: "metric", label: "Net NAV end of period",
      getMutation: (p, code) => {
        const reds = p.mutations.filter((m) => m.type === "redemption")
        if (reds.length === 0) return "—"
        return fmtCcy(reds[0].nav_per_share, code)
      },
    },
    {
      kind: "metric", label: "Amount of shares returned",
      getMutation: (p) => {
        const total = p.mutations
          .filter((m) => m.type === "redemption")
          .reduce((s, m) => s + (m.shares_redeemed ?? 0), 0)
        return total > 0 ? fmt(total, 2) : "—"
      },
    },
    {
      kind: "metric", label: "Total amount of shares outstanding after redemption",
      getMutation: (p) => (p.status === "open" ? OPEN_CELL : fmt(p.total_shares_end, 2)),
    },

    // ── Step 3: Subscription (mutation col only) ──────────────────────────────

    { kind: "section", label: "STEP 3: SUBSCRIPTION", color: "bg-emerald-700 text-white", mutActive: true },
    {
      kind: "metric", label: "The investor(s)",
      getMutation: (p) => investorNames(p.mutations, "subscription"),
    },
    {
      kind: "metric", label: "Amount send to the fund by investors",
      getMutation: (p, code) => {
        const total = p.mutations
          .filter((m) => m.type === "subscription")
          .reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)
        return total > 0 ? fmtCcy(total, code) : "—"
      },
    },
    {
      kind: "metric", label: "Subscription fee (can be stable fee or %)",
      getMutation: (p, code) => {
        const total = p.mutations
          .filter((m) => m.type === "subscription")
          .reduce((s, m) => s + (m.fee_amount ?? 0), 0)
        return total > 0 ? fmtCcy(total, code) : "—"
      },
    },
    {
      kind: "metric", label: "Amount available for buying shares",
      getMutation: (p, code) => {
        const total = p.mutations
          .filter((m) => m.type === "subscription")
          .reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)
        return total > 0 ? fmtCcy(total, code) : "—"
      },
    },
    {
      kind: "metric", label: "Net NAV end of period",
      getMutation: (p, code) => {
        const subs = p.mutations.filter((m) => m.type === "subscription")
        if (subs.length === 0) return "—"
        return fmtCcy(subs[0].nav_per_share, code)
      },
    },
    {
      kind: "metric",
      label: "Amount of shares issued (option to round up or down ,00 or ,0 or 0.)",
      getMutation: (p) => {
        const total = p.mutations
          .filter((m) => m.type === "subscription")
          .reduce((s, m) => s + (m.shares_issued ?? 0), 0)
        return total > 0 ? fmt(total, 2) : "—"
      },
    },

    // ── Step 4 (both cols) ────────────────────────────────────────────────────

    { kind: "section", label: "STEP 4: DATA AFTER MUTATIONS", color: "bg-slate-700 text-white", mutActive: true },
    {
      kind: "metric", label: "Net NAV before mutation",
      getMutation: (p, code) => fmtCcy(p.nav_start, code),
    },
    {
      kind: "metric", label: "Net NAV after mutation",
      getMutation: (p, code) =>
        p.nav_end != null ? fmtCcy(p.nav_end, code) : p.status === "open" ? OPEN_CELL : "—",
    },
    {
      kind: "metric", label: "Total amount of shares outstanding after mutation",
      getMutation: (p) => (p.status === "open" ? OPEN_CELL : fmt(p.total_shares_end, 2)),
    },
  ]
}

// ─── Cap table computation ────────────────────────────────────────────────────

function computeCapTable(periods: PeriodWithMutations[]) {
  const investorMap = new Map<string, string>() // entryId → display name
  for (const period of periods) {
    for (const m of period.mutations) {
      const entryId = m._cap_table_entry?.id
      if (!entryId) continue
      const name = m._cap_table_entry?._shareholder?.name ?? entryId
      if (!investorMap.has(entryId)) investorMap.set(entryId, name)
    }
  }

  const investorIds = Array.from(investorMap.keys())
  const runningShares = new Map<string, number>()
  const snapshotsByPeriod: Map<string, number>[] = []

  for (const period of periods) {
    for (const m of period.mutations) {
      const entryId = m._cap_table_entry?.id
      if (!entryId) continue
      const current = runningShares.get(entryId) ?? 0
      if (m.type === "subscription") {
        runningShares.set(entryId, current + (m.shares_issued ?? 0))
      } else if (m.type === "redemption") {
        runningShares.set(entryId, Math.max(0, current - (m.shares_redeemed ?? 0)))
      }
    }
    snapshotsByPeriod.push(new Map(runningShares))
  }

  return { investorIds, investorMap, snapshotsByPeriod }
}

// ─── Table cell helpers ───────────────────────────────────────────────────────

const tdMut = "px-3 py-1.5 text-right tabular-nums text-[11px] border-l min-w-28"
const tdPer = "px-3 py-1.5 text-right tabular-nums text-[11px] border-l min-w-32"
const tdLabel = "sticky left-0 z-10 bg-background border-r px-3 py-1.5 text-[11px] text-muted-foreground font-medium whitespace-nowrap max-w-[18rem] pr-4"

// ─── Component ────────────────────────────────────────────────────────────────

export function FundNavSheet({
  entityUUID,
  currencyCode = "EUR",
}: {
  entityUUID: string
  currencyCode?: string
}) {
  const [periods, setPeriods] = React.useState<PeriodWithMutations[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [periodsRaw, mutationsRaw, entityStats] = await Promise.all([
          fetch(`/api/fund-periods?entity=${entityUUID}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : [])) as Promise<FundPeriod[]>,
          fetch(`/api/fund-mutations?entity=${entityUUID}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : [])) as Promise<FundMutation[]>,
          fetch(`/api/entity-stats/${entityUUID}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null) as Promise<{ assetsValue: number; liabilitiesValue: number } | null>,
        ])

        const mutsByPeriod = new Map<string, FundMutation[]>()
        for (const m of mutationsRaw) {
          if (!m.period) continue
          const arr = mutsByPeriod.get(m.period) ?? []
          arr.push(m)
          mutsByPeriod.set(m.period, arr)
        }

        const sorted = [...periodsRaw].sort((a, b) => (a.opened_at ?? 0) - (b.opened_at ?? 0))
        setPeriods(
          sorted.map((p) => ({
            ...p,
            mutations: mutsByPeriod.get(p.id) ?? [],
            // For the open period, inject live entity stats; closed periods carry DB snapshots
            ...(p.status === "open" && entityStats
              ? { total_invested_assets: entityStats.assetsValue, total_debt: entityStats.liabilitiesValue }
              : {}),
          }))
        )
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [entityUUID])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
        No periods yet. Open a period from the Manage tab to see the NAV sheet.
      </div>
    )
  }

  const rows = buildRows()
  const { investorIds, investorMap, snapshotsByPeriod } = computeCapTable(periods)
  const totalCols = 1 + periods.length * 2

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-max w-full text-[11px] border-collapse">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <thead>
          <tr className="border-b bg-muted/60">
            <th className="sticky left-0 z-10 bg-muted/60 text-left px-3 py-2 text-xs font-bold border-r min-w-[18rem]">
              NAV CALCULATION
            </th>
            {periods.map((p) => (
              <React.Fragment key={p.id}>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground bg-slate-200 border-l min-w-28">
                  MUTATION
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold border-l min-w-32">
                  <div>{colLabel(p)}</div>
                  {p.status === "open" && (
                    <span className="mt-0.5 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[9px] font-medium">
                      Open
                    </span>
                  )}
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => {
            // ── Section header ──────────────────────────────────────────────
            if (row.kind === "section") {
              const mutCls = row.mutActive ? `${row.color} border-l` : "bg-slate-200 border-l"
              const perCls = row.mutActive ? "bg-slate-200 border-l" : `${row.color} border-l`
              return (
                <tr key={i} className="border-b">
                  <td className={`sticky left-0 px-3 py-1.5 text-[10px] font-bold tracking-wide ${row.color}`}>
                    {row.label}
                  </td>
                  {periods.map((p) => (
                    <React.Fragment key={p.id}>
                      <td className={mutCls} />
                      <td className={perCls} />
                    </React.Fragment>
                  ))}
                </tr>
              )
            }

            // ── Metric row ──────────────────────────────────────────────────
            // Grey out whichever sub-column is inactive for this row
            const mutInactive = !!row.getPeriod && !row.getMutation
            const periodInactive = !!row.getMutation && !row.getPeriod
            return (
              <tr key={i} className="border-b hover:bg-muted/20 transition-colors">
                <td className={tdLabel}>{row.label}</td>
                {periods.map((p) => (
                  <React.Fragment key={p.id}>
                    <td className={mutInactive ? `${tdMut} bg-slate-200!` : tdMut}>
                      {row.getMutation ? row.getMutation(p, currencyCode) : ""}
                    </td>
                    <td className={periodInactive ? `${tdPer} bg-slate-200!` : tdPer}>
                      {row.getPeriod ? row.getPeriod(p, currencyCode) : ""}
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            )
          })}

          {/* ── Cap table spacer ─────────────────────────────────────────────── */}
          <tr className="h-8 bg-slate-200">
            <td colSpan={totalCols} />
          </tr>

          {/* ── Cap table section header ─────────────────────────────────────── */}
          <tr className="border-b">
            <td className="sticky left-0 px-3 py-1.5 text-[10px] font-bold tracking-wide bg-slate-700 text-white">
              CAP TABLE
            </td>
            {periods.map((p) => (
              <React.Fragment key={p.id}>
                <td className="border-l px-3 py-1.5 text-[10px] font-semibold text-right text-slate-500">Shares</td>
                <td className="border-l px-3 py-1.5 text-[10px] font-semibold text-right text-slate-500">Value</td>
              </React.Fragment>
            ))}
          </tr>

          {/* ── Investor rows ────────────────────────────────────────────────── */}
          {investorIds.map((entryId) => (
            <tr key={entryId} className="border-b hover:bg-muted/20 transition-colors">
              <td className={tdLabel}>{investorMap.get(entryId)}</td>
              {periods.map((p, pi) => {
                const shares = snapshotsByPeriod[pi]?.get(entryId) ?? 0
                const nav = p.nav_end ?? p.nav_start
                const value = shares > 0 && nav != null ? shares * nav : null
                return (
                  <React.Fragment key={p.id}>
                    <td className={tdMut}>{shares > 0 ? fmt(shares, 2) : "—"}</td>
                    <td className={tdPer}>{value != null ? fmtCcy(value, currencyCode) : "—"}</td>
                  </React.Fragment>
                )
              })}
            </tr>
          ))}

          {/* ── Total row ────────────────────────────────────────────────────── */}
          <tr className="border-b bg-muted/30 font-semibold">
            <td className={`${tdLabel} font-bold text-foreground`}>Total Shares after Mutation</td>
            {periods.map((p, pi) => {
              const totalShares = Array.from(snapshotsByPeriod[pi]?.values() ?? []).reduce(
                (a, b) => a + b,
                0
              )
              const nav = p.nav_end ?? p.nav_start
              const totalValue = totalShares > 0 && nav != null ? totalShares * nav : null
              return (
                <React.Fragment key={p.id}>
                  <td className={`${tdMut} font-bold text-foreground`}>
                    {totalShares > 0 ? fmt(totalShares, 2) : "—"}
                  </td>
                  <td className={`${tdPer} font-bold text-foreground`}>
                    {totalValue != null ? fmtCcy(totalValue, currencyCode) : "—"}
                  </td>
                </React.Fragment>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
