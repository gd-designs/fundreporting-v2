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

  // 2. Fetch entries, capital calls, and share classes in parallel
  const [allEntries, allCalls, allShareClasses] = await Promise.all([
    fetch(`${base}/cap_table_entry?entity=${entityUUID}`, { headers, cache: "no-store" })
      .then(r => r.ok ? r.json() : []) as Promise<Array<Record<string, unknown>>>,
    fetch(`${base}/capital_call?entity=${entityUUID}`, { headers, cache: "no-store" })
      .then(r => r.ok ? r.json() : []) as Promise<Array<Record<string, unknown>>>,
    fetch(`${base}/share_class?entity=${entityUUID}`, { headers, cache: "no-store" })
      .then(r => r.ok ? r.json() : []) as Promise<Array<Record<string, unknown>>>,
  ])

  const entityEntries = allEntries
  // Only count deployed calls (matches cap-table-manager logic)
  const deployedCalls = allCalls.filter((c) => c.deployed_at != null)

  // Compute shares the same way cap-table-manager does:
  // shares per call = amount / share_class.current_nav
  function sharesForCalls(calls: Array<Record<string, unknown>>) {
    return calls.reduce((sum, c) => {
      const sc = allShareClasses.find(s => s.id === c.share_class)
      const nav = typeof sc?.current_nav === "number" ? sc.current_nav : 0
      const amount = typeof c.amount === "number" ? c.amount : 0
      return sum + (nav > 0 && amount > 0 ? amount / nav : 0)
    }, 0)
  }

  const myEntryIds = new Set(
    entityEntries.filter(e => e.shareholder === shareholderId).map(e => e.id as string)
  )
  const myDeployedCalls = deployedCalls.filter(c => myEntryIds.has(c.cap_table_entry as string))

  const totalShares = sharesForCalls(deployedCalls)
  const shareholderShares = sharesForCalls(myDeployedCalls)

  // Fallback: if share classes aren't linked, use deployed capital amounts
  const totalDeployed = deployedCalls.reduce((s, c) => s + (typeof c.amount === "number" ? c.amount : 0), 0)
  const shareholderDeployed = myDeployedCalls.reduce((s, c) => s + (typeof c.amount === "number" ? c.amount : 0), 0)

  if (totalShares === 0 && totalDeployed === 0) return NextResponse.json({ value: 0, ownershipPct: 0 })

  const ownershipPct = totalShares > 0
    ? shareholderShares / totalShares
    : shareholderDeployed / totalDeployed

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
