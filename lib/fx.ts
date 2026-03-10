"use client"

export async function fetchFxRates(base: string, from: string[]): Promise<Record<string, number>> {
  const normalizedBase = base.trim().toUpperCase()
  const normalizedFrom = Array.from(
    new Set(from.map((c) => c.trim().toUpperCase()).filter((c) => !!c)),
  )
  const query = new URLSearchParams({ base: normalizedBase, from: normalizedFrom.join(",") })
  const res = await fetch(`/api/fx?${query.toString()}`, { cache: "no-store" })
  const payload = (await res.json()) as { rates?: Record<string, number>; message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to load FX rates.")
  return payload.rates ?? { [normalizedBase]: 1 }
}
