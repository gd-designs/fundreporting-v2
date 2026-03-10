import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const shareholderId = req.nextUrl.searchParams.get("shareholder")
  const baseCurrency = req.nextUrl.searchParams.get("baseCurrency") ?? "GBP"
  if (!shareholderId) return NextResponse.json({ value: null }, { status: 400 })

  const token = await getAuthToken()
  if (!token) return NextResponse.json({ value: null }, { status: 401 })

  const headers = { Authorization: `Bearer ${token}` }
  const base = process.env.PLATFORM_API_URL

  // 1. Fetch the shareholder to get the entity (company/fund) UUID
  const shRes = await fetch(`${base}/cap_table_shareholder/${shareholderId}`, {
    headers,
    cache: "no-store",
  })
  if (!shRes.ok) return NextResponse.json({ value: null }, { status: 404 })
  const shareholder = (await shRes.json()) as Record<string, unknown>
  const entityUUID = typeof shareholder.entity === "string" ? shareholder.entity : null
  if (!entityUUID) return NextResponse.json({ value: null })

  // 2. Fetch all cap table entries for the entity in parallel
  const entriesRes = await fetch(`${base}/cap_table_entry`, { headers, cache: "no-store" })
  if (!entriesRes.ok) return NextResponse.json({ value: null })
  const allEntries = (await entriesRes.json()) as Array<Record<string, unknown>>
  const entityEntries = allEntries.filter((e) => e.entity === entityUUID)

  const totalShares = entityEntries.reduce(
    (s, e) => s + (typeof e.shares_issued === "number" ? e.shares_issued : 0),
    0,
  )
  if (totalShares === 0) return NextResponse.json({ value: 0, ownershipPct: 0 })

  const shareholderShares = entityEntries
    .filter((e) => e.shareholder === shareholderId)
    .reduce((s, e) => s + (typeof e.shares_issued === "number" ? e.shares_issued : 0), 0)

  const ownershipPct = shareholderShares / totalShares

  // 3. Fetch entity NAV (reuses the full net-worth calculation with live prices)
  const navParams = new URLSearchParams({ entityUUID, baseCurrency })
  const navRes = await fetch(
    `${req.nextUrl.origin}/api/net-worth?${navParams}`,
    { headers: { Cookie: req.headers.get("cookie") ?? "" }, cache: "no-store" },
  )
  const nav = navRes.ok ? ((await navRes.json()) as { netWorth?: number }).netWorth ?? null : null

  const value = nav !== null ? ownershipPct * nav : null

  return NextResponse.json({
    value,
    ownershipPct,
    shareholderShares,
    totalShares,
    nav,
    entityUUID,
  })
}
