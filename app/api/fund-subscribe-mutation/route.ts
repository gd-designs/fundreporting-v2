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

  // ── 3. Find the entity that holds the equity_stake asset for this shareholder ──
  // Fund-type investors → equity stake lives on the investing fund's entity.
  // Individual/company investors → equity stake lives on their personal portfolio.
  console.log("[fund-subscribe-mutation] shares_issued:", shares_issued, "fundShareholderId:", fundShareholderId)

  if (shares_issued == null || shares_issued <= 0) {
    console.log("[fund-subscribe-mutation] skip: no_shares")
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "no_shares" })
  }

  const shRes = await fetch(`${base}/cap_table_shareholder/${fundShareholderId}`, {
    headers: h,
    cache: "no-store",
  })
  if (!shRes.ok) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "sh_fetch_failed" })
  }
  const shareholder: { type?: string | null; user?: number | null; parent_shareholder?: string | null; linked_fund?: string | null } = await shRes.json()
  const isFundInvestor = shareholder.type === "fund"
  console.log("[fund-subscribe-mutation] shareholder type:", shareholder.type, "linked_fund:", shareholder.linked_fund)

  let investorEntityUUID: string | null = null

  if (isFundInvestor && shareholder.linked_fund) {
    // Fund investor: equity stake lives on the investing fund's entity.
    // linked_fund is the fund record id — we need the entity UUID.
    const fundRes = await fetch(`${base}/fund/${shareholder.linked_fund}`, { headers: h, cache: "no-store" })
    if (fundRes.ok) {
      const fund = (await fundRes.json()) as { entity?: string | null }
      investorEntityUUID = typeof fund.entity === "string" ? fund.entity : null
    }
    console.log("[fund-subscribe-mutation] fund investor entity:", investorEntityUUID)
  } else {
    // Individual/company: equity stake lives on the personal portfolio.
    let userId = shareholder.user ?? null

    // Fund-level shareholder may not have user — try AM-level parent shareholder
    if (userId == null && shareholder.parent_shareholder) {
      const parentRes = await fetch(`${base}/cap_table_shareholder/${shareholder.parent_shareholder}`, {
        headers: h,
        cache: "no-store",
      })
      if (parentRes.ok) {
        const parent: { user?: number | null } = await parentRes.json()
        userId = parent.user ?? null
      }
    }
    console.log("[fund-subscribe-mutation] user:", userId)

    if (userId != null) {
      const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ owner: userId }),
      })
      if (portfoliosRes.ok) {
        const portfolios: Array<{ entity: string }> = await portfoliosRes.json()
        investorEntityUUID = portfolios[0]?.entity ?? null
      }
    }
    console.log("[fund-subscribe-mutation] portfolio entity:", investorEntityUUID)
  }

  if (!investorEntityUUID) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: isFundInvestor ? "no_investing_fund_entity" : "no_portfolio" })
  }

  // ── 4. Find the equity_stake asset on that entity ──────────────────────────
  const assetsRes = await fetch(`${base}/asset?entity=${investorEntityUUID}`, {
    headers: h,
    cache: "no-store",
  })
  if (!assetsRes.ok) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "assets_fetch_failed" })
  }
  const assets: AssetRecord[] = await assetsRes.json()
  const fundAsset = assets.find(
    (a) => a.investable === "equity_stake" && a.cap_table_shareholder === fundShareholderId,
  )
  console.log("[fund-subscribe-mutation] fundAsset:", fundAsset?.id ?? "NOT FOUND", "on entity:", investorEntityUUID)

  if (!fundAsset) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "no_equity_stake_asset", fundShareholderId })
  }

  // ── 5. Record transaction entry with units + price_per_unit ───────────────
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
      created_by_entity: investorEntityUUID,
      date: mutation_at,
    }),
  })
  if (!txRes.ok) {
    return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: false, _skip: "tx_create_failed" })
  }
  const tx: { id: string } = await txRes.json()

  await fetch(`${base}/transaction_entry`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      transaction: tx.id,
      entity: investorEntityUUID,
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

  console.log("[fund-subscribe-mutation] ✓ recorded on entity:", investorEntityUUID, "asset:", fundAsset.id)
  return NextResponse.json({ success: true, mutationId: mutation.id, portfolioRecorded: true, investorEntityUUID })
}
