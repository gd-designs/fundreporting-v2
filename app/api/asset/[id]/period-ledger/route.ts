import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

// GET /api/asset/[id]/period-ledger
// Returns: { fund: {id, name, baseCurrencyCode}, periods, mutations, capTableEntryIds }
//   - periods: fund_period rows for the fund's entity, sorted by opened_at asc
//   - mutations: fund_mutation rows for this asset's investor (filtered to relevant cap_table_entry(ies))
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const base = process.env.PLATFORM_API_URL
  const headers = { Authorization: `Bearer ${token}` }

  // 1. Load asset to get fund + cap_table_entry + cap_table_shareholder
  const assetRes = await fetch(`${base}/asset/${id}`, { headers, cache: "no-store" })
  if (!assetRes.ok) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  const asset = (await assetRes.json()) as {
    id: string
    fund?: string | null
    cap_table_entry?: string | null
    cap_table_shareholder?: string | null
  }

  if (!asset.fund) {
    return NextResponse.json({ fund: null, periods: [], mutations: [], capTableEntryIds: [] })
  }

  // 2. Load fund record → get entity uuid + base_currency
  const fundRes = await fetch(`${base}/fund/${asset.fund}`, { headers, cache: "no-store" })
  if (!fundRes.ok) {
    return NextResponse.json({ error: "Fund not found" }, { status: 404 })
  }
  const fund = (await fundRes.json()) as {
    id: string
    name?: string | null
    entity?: string
    base_currency?: string | null
    currency?: { id?: number; code?: string; name?: string } | null
  }
  if (!fund.entity) {
    return NextResponse.json({ error: "Fund missing entity" }, { status: 500 })
  }

  // 3. Resolve the set of cap_table_entry ids belonging to this investor in this fund.
  let entryIds: string[] = []
  if (asset.cap_table_entry) {
    entryIds = [asset.cap_table_entry]
  } else if (asset.cap_table_shareholder) {
    const entriesRes = await fetch(
      `${base}/cap_table_entry?entity=${encodeURIComponent(fund.entity)}&shareholder=${encodeURIComponent(asset.cap_table_shareholder)}`,
      { headers, cache: "no-store" },
    )
    if (entriesRes.ok) {
      const entries = (await entriesRes.json()) as Array<{ id: string }>
      entryIds = entries.map((e) => e.id)
    }
  }

  // 4. Fetch periods for the fund's entity.
  const periodsRes = await fetch(
    `${base}/fund_period?entity=${encodeURIComponent(fund.entity)}`,
    { headers, cache: "no-store" },
  )
  const periods = periodsRes.ok ? ((await periodsRes.json()) as Array<Record<string, unknown>>) : []

  // 5. Fetch all fund_mutations for the fund and filter by cap_table_entry client-side.
  // (The CRUD endpoint may not support filtering by cap_table_entry directly.)
  const mutationsRes = await fetch(
    `${base}/fund_mutation?entity=${encodeURIComponent(fund.entity)}`,
    { headers, cache: "no-store" },
  )
  const allMutations = mutationsRes.ok
    ? ((await mutationsRes.json()) as Array<Record<string, unknown>>)
    : []
  const entrySet = new Set(entryIds)
  const mutations = entrySet.size === 0
    ? []
    : allMutations.filter((m) => typeof m.cap_table_entry === "string" && entrySet.has(m.cap_table_entry as string))

  return NextResponse.json({
    fund: {
      id: fund.id,
      name: fund.name ?? null,
      entity: fund.entity,
      currencyCode: fund.currency?.code ?? null,
    },
    periods,
    mutations,
    capTableEntryIds: entryIds,
  })
}
