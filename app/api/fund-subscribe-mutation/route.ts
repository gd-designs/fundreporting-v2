import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

// POST /api/fund-subscribe-mutation
// Creates a fund subscription mutation, marks the capital call as deployed,
// then records the shares on the investor's portfolio equity_stake asset.

interface SubscribeMutationBody {
  // Mutation fields
  entityUUID: string         // fund entity UUID
  periodId?: string | null
  cap_table_entry: string
  nav_per_share: number
  amount_invested: number
  fee_rate?: number | null
  fee_amount?: number | null
  amount_for_shares: number
  shares_issued: number | null
  mutation_at: number
  // Capital call to mark deployed
  callId: string
  // Investor portfolio lookup
  fundShareholderId: string  // cap_table_shareholder id (fund-level) — links to equity_stake asset
  currencyId?: number        // defaults to 1 (EUR)
}

type AssetRecord = {
  id: string
  investable?: string | null
  cap_table_shareholder?: string | null
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body: SubscribeMutationBody = await req.json()
  const {
    entityUUID,
    periodId,
    cap_table_entry,
    nav_per_share,
    amount_invested,
    fee_rate,
    fee_amount,
    amount_for_shares,
    shares_issued,
    mutation_at,
    callId,
    fundShareholderId,
    currencyId = 1,
  } = body

  const base = process.env.PLATFORM_API_URL!
  const h = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  // ── 1. Create fund mutation ────────────────────────────────────────────────
  const mutBody: Record<string, unknown> = {
    entity: entityUUID,
    cap_table_entry,
    type: "subscription",
    nav_per_share,
    amount_invested,
    amount_for_shares,
    mutation_at,
  }
  if (periodId) mutBody.period = periodId
  if (fee_rate != null) mutBody.fee_rate = fee_rate
  if (fee_amount != null && fee_amount > 0) mutBody.fee_amount = fee_amount
  if (shares_issued != null) mutBody.shares_issued = shares_issued

  const mutRes = await fetch(`${base}/fund_mutation`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(mutBody),
  })
  if (!mutRes.ok) {
    return NextResponse.json(
      { error: "Failed to create mutation", detail: await mutRes.text() },
      { status: mutRes.status },
    )
  }
  const mutation: { id: string } = await mutRes.json()

  // ── 2. Mark capital call as deployed ──────────────────────────────────────
  await fetch(`${base}/capital_call/${callId}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ deployed_at: mutation_at }),
  })

  // ── 3. Find investor portfolio via shareholder → user ─────────────────────
  console.log("[fund-subscribe-mutation] shares_issued:", shares_issued, "fundShareholderId:", fundShareholderId)

  if (shares_issued == null || shares_issued <= 0) {
    console.log("[fund-subscribe-mutation] skip: no_shares")
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "no_shares" })
  }

  const shRes = await fetch(`${base}/cap_table_shareholder/${fundShareholderId}`, {
    headers: h,
    cache: "no-store",
  })
  console.log("[fund-subscribe-mutation] shareholder fetch status:", shRes.status)
  if (!shRes.ok) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "sh_fetch_failed", _shStatus: shRes.status })
  }
  const shareholder: { user?: number | null; parent_shareholder?: string | null } = await shRes.json()
  let userId = shareholder.user ?? null
  console.log("[fund-subscribe-mutation] shareholder.user:", userId, "parent_shareholder:", shareholder.parent_shareholder)

  // Fund-level shareholder may not have user — try AM-level parent shareholder
  if (userId == null && shareholder.parent_shareholder) {
    const parentRes = await fetch(`${base}/cap_table_shareholder/${shareholder.parent_shareholder}`, {
      headers: h,
      cache: "no-store",
    })
    if (parentRes.ok) {
      const parent: { user?: number | null } = await parentRes.json()
      userId = parent.user ?? null
      console.log("[fund-subscribe-mutation] parent shareholder.user:", userId)
    }
  }

  if (userId == null) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "no_user_on_shareholder" })
  }

  const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ owner: userId }),
  })
  console.log("[fund-subscribe-mutation] portfolio/by-owner status:", portfoliosRes.status)
  if (!portfoliosRes.ok) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "portfolio_fetch_failed", _portfolioStatus: portfoliosRes.status })
  }
  const portfolios: Array<{ id: string; entity: string }> = await portfoliosRes.json()
  const portfolioEntityUUID = portfolios[0]?.entity ?? null
  console.log("[fund-subscribe-mutation] portfolioEntityUUID:", portfolioEntityUUID)

  if (!portfolioEntityUUID) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "no_portfolio", userId })
  }

  const assetsRes = await fetch(`${base}/asset?entity=${portfolioEntityUUID}`, {
    headers: h,
    cache: "no-store",
  })
  console.log("[fund-subscribe-mutation] assets fetch status:", assetsRes.status)
  if (!assetsRes.ok) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "assets_fetch_failed" })
  }
  const assets: AssetRecord[] = await assetsRes.json()
  console.log("[fund-subscribe-mutation] assets:", assets.map(a => ({ id: a.id, investable: a.investable, cap_table_shareholder: a.cap_table_shareholder })))
  const fundAsset = assets.find(
    (a) => a.investable === "equity_stake" && a.cap_table_shareholder === fundShareholderId,
  )
  console.log("[fund-subscribe-mutation] fundAsset:", fundAsset ?? "NOT FOUND")

  if (!fundAsset) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "no_equity_stake_asset", fundShareholderId, _assets: assets.map(a => ({ id: a.id, investable: a.investable, cap_table_shareholder: a.cap_table_shareholder })) })
  }

  // ── 5. Record transaction entry with units + price_per_unit ───────────────
  // Find subscription transaction type
  let subscriptionTypeId: number | null = null
  const ttRes = await fetch(`${base}/transaction_type`, { headers: h, cache: "no-store" })
  if (ttRes.ok) {
    const ttList: Array<{ id: number; name?: string }> = await ttRes.json()
    const sub = ttList.find((t) => t.name?.toLowerCase() === "subscription")
    const buy = ttList.find((t) => t.name?.toLowerCase() === "buy")
    subscriptionTypeId = sub?.id ?? buy?.id ?? null
  }

  const txRes = await fetch(`${base}/transaction`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      type: subscriptionTypeId,
      reference: `Fund subscription — ${shares_issued.toFixed(4)} shares @ ${nav_per_share}`,
      created_by_entity: portfolioEntityUUID,
      date: mutation_at,
    }),
  })
  if (!txRes.ok) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false })
  }
  const tx: { id: string } = await txRes.json()

  await fetch(`${base}/transaction_entry`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      transaction: tx.id,
      entity: portfolioEntityUUID,
      entry_type: "equity",
      object_type: "asset",
      object_id: fundAsset.id,
      direction: "in",
      currency: currencyId,
      amount: amount_for_shares,
      units: shares_issued,
      price_per_unit: nav_per_share,
      source: "subscription",
      source_id: mutation.id,
    }),
  })

  return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: true })
}
