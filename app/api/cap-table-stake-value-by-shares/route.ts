import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

/**
 * Compute an equity stake's live value using fund_mutation share records
 * rather than the ownershipPct × net-worth method.
 *
 * Live value = Σ(net shares per share class × share_class.current_nav)
 *
 * Query params:
 *   shareholder  — the cap_table_shareholder id (on the fund's cap table)
 *   fundEntity   — the fund's entity UUID (where the fund_mutations live)
 */
export async function GET(req: NextRequest) {
  const shareholderId = req.nextUrl.searchParams.get("shareholder")
  const fundEntityUUID = req.nextUrl.searchParams.get("fundEntity")
  if (!shareholderId || !fundEntityUUID) {
    return NextResponse.json({ value: null }, { status: 400 })
  }

  const token = await getAuthToken()
  if (!token) return NextResponse.json({ value: null }, { status: 401 })

  const headers = { Authorization: `Bearer ${token}` }
  const base = process.env.PLATFORM_API_URL

  // 1. Fetch cap_table_entries for this shareholder on the fund entity
  const [entriesRes, mutationsRes, shareClassesRes] = await Promise.all([
    fetch(`${base}/cap_table_entry?entity=${fundEntityUUID}`, { headers, cache: "no-store" }),
    fetch(`${base}/fund_mutation?entity=${fundEntityUUID}`, { headers, cache: "no-store" }),
    fetch(`${base}/share_class?entity=${fundEntityUUID}`, { headers, cache: "no-store" }),
  ])

  const allEntries = entriesRes.ok
    ? ((await entriesRes.json()) as Array<Record<string, unknown>>)
    : []
  const allMutations = mutationsRes.ok
    ? ((await mutationsRes.json()) as Array<Record<string, unknown>>)
    : []
  const allShareClasses = shareClassesRes.ok
    ? ((await shareClassesRes.json()) as Array<Record<string, unknown>>)
    : []

  // 2. Filter entries belonging to this shareholder
  const myEntryIds = new Set(
    allEntries
      .filter((e) => e.shareholder === shareholderId)
      .map((e) => e.id as string)
  )

  // Build share class → current_nav map
  const scNavMap = new Map<string, number>()
  for (const sc of allShareClasses) {
    if (typeof sc.id === "string" && typeof sc.current_nav === "number") {
      scNavMap.set(sc.id, sc.current_nav)
    }
  }

  // 3. Aggregate net shares per share class from fund_mutations
  // Each mutation's share class comes from its linked cap_table_entry
  const entryShareClassMap = new Map<string, string>()
  for (const e of allEntries) {
    if (typeof e.id === "string" && typeof e.share_class === "string") {
      entryShareClassMap.set(e.id, e.share_class)
    }
  }

  const sharesByClass = new Map<string, number>()
  let totalNetShares = 0
  for (const m of allMutations) {
    const entryId = (m.cap_table_entry ?? (m._cap_table_entry as Record<string, unknown> | undefined)?.id) as string | undefined
    if (!entryId || !myEntryIds.has(entryId)) continue

    const issued = typeof m.shares_issued === "number" ? m.shares_issued : 0
    const redeemed = typeof m.shares_redeemed === "number" ? m.shares_redeemed : 0
    const delta = issued - redeemed
    totalNetShares += delta

    const scId = entryShareClassMap.get(entryId)
    if (scId) {
      sharesByClass.set(scId, (sharesByClass.get(scId) ?? 0) + delta)
    }
  }

  // 4. Live value = Σ(net shares per class × class current_nav)
  let liveValue = 0
  for (const [scId, netShares] of sharesByClass) {
    const nav = scNavMap.get(scId) ?? 0
    if (netShares > 0 && nav > 0) {
      liveValue += netShares * nav
    }
  }

  return NextResponse.json({
    value: liveValue,
    netShares: totalNetShares,
    sharesByClass: Object.fromEntries(sharesByClass),
  })
}
