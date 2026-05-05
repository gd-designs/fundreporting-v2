import { useEffect, useState } from "react"

export type FundPeriod = {
  id: string
  status?: "open" | "closed" | null
  label?: string | null
  opened_at?: number | null
  closed_at?: number | null
  nav_start?: number | null
  nav_gross_end?: number | null
  nav_end?: number | null
  yield_gross?: number | null
  yield_net?: number | null
  management_fee_per_share?: number | null
  performance_fee_per_share?: number | null
  total_shares_start?: number | null
  total_shares_end?: number | null
}

export type FundMutation = {
  id: string
  period?: string | null
  cap_table_entry?: string | null
  type?: "subscription" | "redemption" | "distribution" | null
  mutation_at?: number | null
  nav_per_share?: number | null
  amount_invested?: number | null
  amount_for_shares?: number | null
  amount_distributed?: number | null
  amount_returned?: number | null
  shares_issued?: number | null
  shares_redeemed?: number | null
  fee_amount?: number | null
}

export type LedgerRow =
  | {
      kind: "initial"
      date: number
      grossValue: number
      netValue: number
    }
  | {
      kind: "period"
      index: number
      period: FundPeriod
      unitsOpen: number
      unitsClose: number
      grossNavOpen: number | null
      grossNavClose: number | null
      netNavOpen: number | null
      netNavClose: number | null
      grossValueOpen: number | null
      grossValueClose: number | null
      netValueOpen: number | null
      netValueClose: number | null
      grossReturnAbs: number | null
      grossReturnPct: number | null
      feeTotal: number | null
      feePerUnit: number | null
      netReturnPct: number | null
      netMutation: number | null
      cumMutation: number
      cumValue: number | null
      cumReturnPct: number | null
    }
  | {
      kind: "distribution"
      mutation: FundMutation
      date: number
      amount: number
      label: string
    }
  | {
      kind: "subscription" | "redemption"
      mutation: FundMutation
      date: number
      amount: number
      shares: number
      navPerShare: number | null
      label: string
    }

export type LedgerEventMarker = {
  date: number
  balance: number
  kind: "subscription" | "redemption" | "initial"
  label: string
}

export type LedgerSeriesPoint = {
  date: number
  capital: number    // sum of net subscriptions (red line)
  balance: number    // current in-fund value (blue line)
  cumValue: number   // balance + cumulative distributions received (green line)
  label: string
}

export type LedgerComputation = {
  rows: LedgerRow[]
  series: LedgerSeriesPoint[]
  eventMarkers: LedgerEventMarker[]
  latestPeriodStart: number | null
}

function pctToPct(value: number | null | undefined): number | null {
  if (value == null) return null
  return value * 100
}

function feePerUnitFor(p: FundPeriod): number {
  return (p.management_fee_per_share ?? 0) + (p.performance_fee_per_share ?? 0)
}

export function computeLedger(periods: FundPeriod[], mutations: FundMutation[]): LedgerComputation {
  const sortedMutations = [...mutations].sort(
    (a, b) => (a.mutation_at ?? 0) - (b.mutation_at ?? 0),
  )

  const firstSub = sortedMutations.find((m) => m.type === "subscription")
  const initialDate = firstSub?.mutation_at ?? 0
  const initialAmount = firstSub?.amount_invested ?? firstSub?.amount_for_shares ?? 0

  const eligiblePeriods = [...periods]
    .filter((p) => firstSub == null || (p.closed_at ?? Infinity) >= initialDate)
    .sort((a, b) => (a.opened_at ?? 0) - (b.opened_at ?? 0))

  const rows: LedgerRow[] = []
  const series: LedgerSeriesPoint[] = []
  const eventMarkers: LedgerEventMarker[] = []

  function snapshot(date: number, label: string) {
    series.push({
      date,
      capital: cumInvested,
      balance: runningNetValue,
      cumValue: runningNetValue + cumDistributions,
      label,
    })
  }

  if (firstSub) {
    rows.push({ kind: "initial", date: initialDate, grossValue: initialAmount, netValue: initialAmount })
    eventMarkers.push({ date: initialDate, balance: initialAmount, kind: "initial", label: "Initial Investment" })
  }

  // Running state walked chronologically across all periods.
  let runningUnits = 0
  let runningNetValue = 0
  let cumMutation = 0
  let cumDistributions = 0
  let cumInvested = 0

  function applyMutation(m: FundMutation) {
    const shares = (m.shares_issued ?? 0) - (m.shares_redeemed ?? 0)
    if (m.type === "subscription") {
      const cash = m.amount_invested ?? m.amount_for_shares ?? 0
      runningUnits += shares
      runningNetValue += cash
      cumInvested += cash
    } else if (m.type === "redemption") {
      const cash = m.amount_returned ?? 0
      runningUnits += shares // shares is negative for redemptions (shares_redeemed > 0)
      runningNetValue -= cash
      cumInvested -= cash
    } else if (m.type === "distribution") {
      const amount = m.amount_distributed ?? 0
      runningNetValue -= amount
      cumDistributions += amount
    }
  }

  eligiblePeriods.forEach((period, idx) => {
    const opened = period.opened_at ?? 0
    const closed = period.closed_at ?? 0

    // 1. Find the mutations attached to this period (via the period FK,
    //    falling back to date-range matching when the FK isn't set).
    const attached = sortedMutations
      .filter((m) => {
        if (m.period) return m.period === period.id
        const t = m.mutation_at ?? 0
        return t >= opened && (period.closed_at == null || t <= closed)
      })
      .sort((a, b) => (a.mutation_at ?? 0) - (b.mutation_at ?? 0))

    // 2. Apply them to running state and queue up event rows. Render BEFORE the
    //    period row so each event appears between the prior period and the period
    //    it triggers.
    const eventRows: LedgerRow[] = []
    for (const m of attached) {
      const t = m.mutation_at ?? 0
      applyMutation(m)
      if (m === firstSub) {
        snapshot(t, "Initial Investment")
        continue
      }
      if (m.type === "distribution") {
        const amount = m.amount_distributed ?? m.amount_returned ?? 0
        eventRows.push({
          kind: "distribution",
          mutation: m,
          date: t,
          amount,
          label: "Distribution",
        })
        snapshot(t, `${dateLabel(t)} · Distribution`)
      } else if (m.type === "subscription" || m.type === "redemption") {
        const shares = (m.shares_issued ?? 0) - (m.shares_redeemed ?? 0)
        const isRed = m.type === "redemption" || shares < 0
        const amount = isRed ? (m.amount_returned ?? 0) : (m.amount_invested ?? m.amount_for_shares ?? 0)
        eventRows.push({
          kind: isRed ? "redemption" : "subscription",
          mutation: m,
          date: t,
          amount,
          shares: Math.abs(shares),
          navPerShare: m.nav_per_share ?? null,
          label: isRed ? "Redemption" : "Reinvestment",
        })
        eventMarkers.push({
          date: t,
          balance: runningNetValue,
          kind: isRed ? "redemption" : "subscription",
          label: `${dateLabel(t)} · ${isRed ? "Redemption" : "Reinvestment"}`,
        })
        snapshot(t, `${dateLabel(t)} · ${isRed ? "Redemption" : "Reinvestment"}`)
      }
    }
    rows.push(...eventRows)

    // 3. Period opening = post-event state; mark to market at close.
    const navStart = period.nav_start ?? null
    const navEnd = period.nav_end ?? null
    const navGrossEnd = period.nav_gross_end ?? null

    const unitsOpen = runningUnits
    const unitsClose = runningUnits
    const grossValueOpen = navStart != null ? navStart * unitsOpen : null
    const grossValueClose = navGrossEnd != null ? navGrossEnd * unitsClose : null
    const netValueOpen = navStart != null ? runningNetValue : null
    let netValueClose: number | null = null
    if (navEnd != null) {
      netValueClose = navEnd * unitsClose
      runningNetValue = netValueClose
    }

    const netMutation =
      netValueClose != null && netValueOpen != null ? netValueClose - netValueOpen : null
    const grossReturnAbs =
      grossValueClose != null && grossValueOpen != null ? grossValueClose - grossValueOpen : null

    if (netMutation != null) cumMutation += netMutation

    const feePerUnit = feePerUnitFor(period)
    const feeTotal = feePerUnit * unitsClose

    // cumValue surfaces total wealth at this period's close, including all
    // distributions received so far (per the spec).
    const cumValue = netValueClose != null ? netValueClose + cumDistributions : null
    const cumReturnPct =
      cumValue != null && cumInvested > 0 ? ((cumValue - cumInvested) / cumInvested) * 100 : null

    rows.push({
      kind: "period",
      index: idx + 1,
      period,
      unitsOpen,
      unitsClose,
      grossNavOpen: navStart,
      grossNavClose: navGrossEnd,
      netNavOpen: navStart,
      netNavClose: navEnd,
      grossValueOpen,
      grossValueClose,
      netValueOpen,
      netValueClose,
      grossReturnAbs,
      grossReturnPct: pctToPct(period.yield_gross),
      feeTotal,
      feePerUnit,
      netReturnPct: pctToPct(period.yield_net),
      netMutation,
      cumMutation,
      cumValue,
      cumReturnPct,
    })

    if (netValueClose != null && unitsClose > 0 && period.status !== "open") {
      snapshot(closed, `${dateLabel(closed)} · Close`)
    }
  })

  series.sort((a, b) => a.date - b.date)
  eventMarkers.sort((a, b) => a.date - b.date)

  // Reverse for most-recent-first display.
  // Strategy: keep the "Initial Investment" row at the bottom (oldest entry),
  // and reverse the period blocks so the newest period appears at the top.
  // Events stay attached to (and visually below) their period.
  const initialIdx = rows.findIndex((r) => r.kind === "initial")
  const initialRow = initialIdx >= 0 ? rows[initialIdx] : null
  const rest = initialRow ? rows.slice(initialIdx + 1) : rows
  const reversed = [...rest].reverse()
  if (initialRow) reversed.push(initialRow)

  const closedEligiblePeriods = eligiblePeriods.filter((p) => p.status !== "open" && p.closed_at != null)
  const latestPeriodStart =
    closedEligiblePeriods.length > 0
      ? closedEligiblePeriods[closedEligiblePeriods.length - 1].opened_at ?? null
      : null

  return { rows: reversed, series, eventMarkers, latestPeriodStart }
}

function dateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export type PeriodLedgerResponse = {
  fund: { id: string; name: string | null; entity: string; currencyCode: string | null } | null
  periods: FundPeriod[]
  mutations: FundMutation[]
  capTableEntryIds: string[]
}

export function usePeriodLedger(assetId: string | null | undefined) {
  const [data, setData] = useState<PeriodLedgerResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assetId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/asset/${assetId}/period-ledger`, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) {
          setError(json.error ?? "Failed to load period ledger")
          setData(null)
          return
        }
        setData(json as PeriodLedgerResponse)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assetId])

  return { data, loading, error }
}
