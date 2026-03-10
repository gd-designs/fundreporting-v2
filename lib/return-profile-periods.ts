"use client"

import type { ReturnProfile } from "@/lib/return-profiles"

export type Period = {
  periodStart: Date
  periodEnd: Date
  collectionDate: Date
  expectedAmount: number
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0)
}

function clampDay(year: number, month: number, day: number): Date {
  const last = lastDayOfMonth(year, month).getDate()
  return new Date(year, month, Math.min(day, last))
}

export function generatePeriodsForYear(profile: ReturnProfile, year: number): Period[] {
  // cash_flow needs amount; compounding needs rate — both need frequency
  if (!profile.frequency) return []
  if (profile.type === "cash_flow" && !profile.amount) return []
  if (profile.type === "compounding" && !profile.rate) return []

  const profileStart = profile.start ? new Date(profile.start) : new Date()
  const profileEnd = profile.end ? new Date(profile.end) : null
  const collectionDay = profile.collection ? new Date(profile.collection).getDate() : 15
  // For compounding, expectedAmount is 0 — computed dynamically in the table
  const amount = profile.amount ?? 0

  const periods: Period[] = []

  if (profile.frequency === "monthly") {
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1)
      const monthEnd = lastDayOfMonth(year, m)

      // period is entirely before profile start or after profile end — skip
      if (monthEnd < profileStart) continue
      if (profileEnd && monthStart > profileEnd) continue

      const periodStart = monthStart < profileStart ? profileStart : monthStart
      const periodEnd = profileEnd && monthEnd > profileEnd ? profileEnd : monthEnd
      const collectionDate = clampDay(year, m, collectionDay)

      periods.push({ periodStart, periodEnd, collectionDate, expectedAmount: amount })
    }
  } else if (profile.frequency === "quarterly") {
    for (let q = 0; q < 4; q++) {
      const qStart = new Date(year, q * 3, 1)
      const qEnd = lastDayOfMonth(year, q * 3 + 2)

      if (qEnd < profileStart) continue
      if (profileEnd && qStart > profileEnd) continue

      const periodStart = qStart < profileStart ? profileStart : qStart
      const periodEnd = profileEnd && qEnd > profileEnd ? profileEnd : qEnd
      const mid = q * 3 + 1 // middle month of quarter
      const collectionDate = clampDay(year, mid, collectionDay)

      periods.push({ periodStart, periodEnd, collectionDate, expectedAmount: amount })
    }
  } else if (profile.frequency === "bi-annually") {
    for (let h = 0; h < 2; h++) {
      const hStart = new Date(year, h * 6, 1)
      const hEnd = lastDayOfMonth(year, h * 6 + 5)

      if (hEnd < profileStart) continue
      if (profileEnd && hStart > profileEnd) continue

      const periodStart = hStart < profileStart ? profileStart : hStart
      const periodEnd = profileEnd && hEnd > profileEnd ? profileEnd : hEnd
      const collectionDate = clampDay(year, h * 6 + 2, collectionDay)

      periods.push({ periodStart, periodEnd, collectionDate, expectedAmount: amount })
    }
  } else if (profile.frequency === "annually") {
    const aStart = new Date(year, 0, 1)
    const aEnd = new Date(year, 11, 31)

    if (aEnd >= profileStart && (!profileEnd || aStart <= profileEnd)) {
      const periodStart = aStart < profileStart ? profileStart : aStart
      const periodEnd = profileEnd && aEnd > profileEnd ? profileEnd : aEnd
      const collectionDate = clampDay(year, 11, collectionDay)
      periods.push({ periodStart, periodEnd, collectionDate, expectedAmount: amount })
    }
  } else if (profile.frequency === "weekly") {
    // Generate weekly periods (Mon-Sun) for the year
    const d = new Date(year, 0, 1)
    // advance to Monday
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
    while (d.getFullYear() <= year) {
      const wStart = new Date(d)
      const wEnd = new Date(d)
      wEnd.setDate(wEnd.getDate() + 6)

      if (wEnd < profileStart) { d.setDate(d.getDate() + 7); continue }
      if (profileEnd && wStart > profileEnd) break
      if (wStart.getFullYear() > year) break

      const periodStart = wStart < profileStart ? profileStart : wStart
      const periodEnd = profileEnd && wEnd > profileEnd ? profileEnd : wEnd
      const collectionDate = new Date(wStart)
      collectionDate.setDate(collectionDate.getDate() + Math.min(collectionDay - 1, 6))

      periods.push({ periodStart, periodEnd, collectionDate, expectedAmount: amount })
      d.setDate(d.getDate() + 7)
    }
  } else if (profile.frequency === "daily") {
    const d = new Date(Math.max(new Date(year, 0, 1).getTime(), profileStart.getTime()))
    const yearEnd = new Date(year, 11, 31)
    const end = profileEnd && profileEnd < yearEnd ? profileEnd : yearEnd
    while (d <= end) {
      periods.push({
        periodStart: new Date(d),
        periodEnd: new Date(d),
        collectionDate: new Date(d),
        expectedAmount: amount,
      })
      d.setDate(d.getDate() + 1)
    }
  }

  return periods
}

export function formatPeriodDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export async function fetchProfileEntries(profileId: string, assetId: string) {
  const res = await fetch(
    `/api/transaction-entries?source=return_profile&source_id=${encodeURIComponent(profileId)}&object_id=${encodeURIComponent(assetId)}`,
    { cache: "no-store" }
  )
  if (!res.ok) return []
  const data = await res.json() as { entries?: unknown[] }
  return Array.isArray(data.entries) ? data.entries : []
}

export function sumTrueIncomeForPeriod(
  entries: Array<Record<string, unknown>>,
  periodStart: Date,
  periodEnd: Date
): number {
  let total = 0
  for (const e of entries) {
    if (e.direction !== "in" || e.entry_type !== "income") continue
    const tx = e._transaction as Record<string, unknown> | undefined
    const date = typeof tx?.date === "number" ? tx.date : 0
    if (!date) continue
    const d = new Date(date)
    if (d >= periodStart && d <= periodEnd) {
      total += typeof e.amount === "number" ? e.amount : 0
    }
  }
  return total
}

// ── Compounding helpers ────────────────────────────────────────────────────

export type RawMutation = {
  id: string
  date: number  // ms timestamp
  delta: number
  source_id: string | null
}

export async function fetchProfileMutations(profileId: string, assetId: string): Promise<RawMutation[]> {
  try {
    const res = await fetch(
      `/api/mutations?asset=${encodeURIComponent(assetId)}&source=return_profile&source_id=${encodeURIComponent(profileId)}`,
      { cache: "no-store" }
    )
    if (!res.ok) return []
    const data = await res.json() as Array<Record<string, unknown>>
    return data.map((m) => ({
      id: typeof m.id === "string" ? m.id : "",
      date: typeof m.date === "number" ? m.date : 0,
      delta: typeof m.delta === "number" ? m.delta : 0,
      source_id: typeof m.source_id === "string" ? m.source_id : null,
    }))
  } catch {
    return []
  }
}

export function sumRecordedGrowthForPeriod(
  mutations: RawMutation[],
  periodStart: Date,
  periodEnd: Date
): number {
  return mutations
    .filter((m) => {
      const d = new Date(m.date)
      return d >= periodStart && d <= periodEnd
    })
    .reduce((s, m) => s + m.delta, 0)
}

/**
 * Compute the expected growth delta for a single period.
 *
 * Simple  — always `principal × rate%` (flat on original principal).
 * Compound — `(principal + cumulativePreviousMutations) × rate%` (snowballs).
 *
 * If profile has an overrideAmount, that takes precedence for both methods.
 */
export function computeExpectedGrowth(
  profile: ReturnProfile,
  periodStart: Date,
  principal: number,
  allMutations: RawMutation[]
): number {
  // For compounding, profile.amount is the optional fixed override
  if (profile.amount != null && profile.amount > 0) {
    return profile.amount
  }

  const rate = profile.rate ?? 0
  if (rate === 0) return 0

  if (profile.method === "simple" || !profile.method) {
    return principal * (rate / 100)
  }

  // compound: accumulate all mutations recorded strictly before this period
  const cumulative = allMutations
    .filter((m) => new Date(m.date) < periodStart)
    .reduce((s, m) => s + m.delta, 0)

  return (principal + cumulative) * (rate / 100)
}
