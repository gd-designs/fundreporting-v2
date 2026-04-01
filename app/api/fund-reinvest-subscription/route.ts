import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

interface ReinvestBody {
  entryId: string            // existing cap table entry to add the call to
  fundShareholderId: string  // existing fund-level shareholder
  fundEntityUUID: string
  shareClassId?: string
  shareClassFeeId?: string
  callAmount: number
  subscriptionDate?: number
  entryFeeRateDecimal?: number
  markDeployed?: boolean
  currencyId?: number
  fundId?: string
}

type AssetRecord = {
  id: string
  entity: string
  asset_class?: number | null
  investable?: string | null
  currency?: number | null
  cap_table_shareholder?: string | null
  cap_table_entry?: string | null
  fund?: string | null
  name?: string | null
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body: ReinvestBody = await req.json()
  const {
    entryId,
    fundShareholderId,
    fundEntityUUID,
    shareClassId,
    shareClassFeeId,
    callAmount,
    subscriptionDate = Date.now(),
    entryFeeRateDecimal = 0,
    markDeployed = false,
    currencyId = 1,
    fundId,
  } = body

  if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 })
  if (!fundShareholderId) return NextResponse.json({ error: "fundShareholderId is required" }, { status: 400 })
  if (!callAmount || callAmount <= 0) return NextResponse.json({ error: "callAmount must be positive" }, { status: 400 })

  const base = process.env.PLATFORM_API_URL!
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  const feeAmount = callAmount * (entryFeeRateDecimal ?? 0)
  const netForShares = callAmount

  // ── Fetch existing shareholder (need name + user for investor portfolio) ──────
  const shRes = await fetch(`${base}/cap_table_shareholder/${fundShareholderId}`, { headers: h, cache: "no-store" })
  if (!shRes.ok) return NextResponse.json({ error: "Shareholder not found" }, { status: 404 })
  const existingSh: { id: string; name?: string | null; user?: number | null } = await shRes.json()
  const name = existingSh.name ?? "Investor"
  const userId: number | null = existingSh.user ?? null

  // ── Step 1: New capital call on the EXISTING entry ────────────────────────────
  const createCallRes = await fetch(`${base}/capital_call`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID,
      cap_table_entry: entryId,
      amount: callAmount,
      called_at: subscriptionDate,
      status: "paid",
    }),
  })
  if (!createCallRes.ok) {
    return NextResponse.json({ error: "Failed to create capital call", detail: await createCallRes.text() }, { status: 500 })
  }
  const call: { id: string } = await createCallRes.json()

  const callPatch: Record<string, unknown> = { called_at: subscriptionDate, received_at: subscriptionDate }
  if (shareClassId) callPatch.share_class = shareClassId
  if (feeAmount > 0) {
    callPatch.fee_amount = feeAmount
    if (shareClassFeeId) callPatch.share_class_fee = shareClassFeeId
  }
  if (markDeployed) callPatch.deployed_at = subscriptionDate
  await fetch(`${base}/capital_call/${call.id}`, { method: "PATCH", headers: h, body: JSON.stringify(callPatch) })

  // Bump committed_amount on the entry so it stays >= total called
  const entryRes = await fetch(`${base}/cap_table_entry/${entryId}`, { headers: h, cache: "no-store" })
  if (entryRes.ok) {
    const entry: { committed_amount?: number | null } = await entryRes.json()
    const currentCommitted = entry.committed_amount ?? 0
    const newCommitted = currentCommitted + callAmount
    await fetch(`${base}/cap_table_entry/${entryId}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ committed_amount: newCommitted }),
    })
  }

  // ── Step 2: Fund cash asset ───────────────────────────────────────────────────
  let fundCashAssetId: string | null = null

  type FundRecord = { name?: string | null; country?: number | null }
  const fundName_country: FundRecord = fundId
    ? await fetch(`${base}/fund/${fundId}`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    : {}
  const fundName = fundName_country.name ?? null
  const fundCountry = fundName_country.country ?? null

  const fundAssetsRes = await fetch(`${base}/asset?entity=${fundEntityUUID}`, { headers: h, cache: "no-store" })
  if (fundAssetsRes.ok) {
    const fundAssets: AssetRecord[] = await fundAssetsRes.json()
    const cashAsset = fundAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
    if (cashAsset) fundCashAssetId = cashAsset.id
  }

  if (!fundCashAssetId) {
    const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" })
    const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
    const createCashRes = await fetch(`${base}/asset`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        entity: fundEntityUUID, asset_class: 1, name: currencyName, currency: currencyId,
        ...(fundCountry != null ? { country: fundCountry } : {}),
        investable: "investable_cash", locked: true,
      }),
    })
    if (createCashRes.ok) fundCashAssetId = ((await createCashRes.json()) as { id: string }).id
  }

  // ── Step 3: Fund transaction (reinvestment cash inflow) ───────────────────────
  let subscriptionTypeId: number | null = null
  const ttRes = await fetch(`${base}/transaction_type`, { headers: h, cache: "no-store" })
  if (ttRes.ok) {
    const ttList: Array<{ id: number; name?: string }> = await ttRes.json()
    const sub = ttList.find((t) => t.name?.toLowerCase() === "subscription")
    const buy = ttList.find((t) => t.name?.toLowerCase() === "buy")
    subscriptionTypeId = sub?.id ?? buy?.id ?? null
  }

  if (fundCashAssetId) {
    const fundTxRes = await fetch(`${base}/transaction`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        type: subscriptionTypeId,
        reference: `Reinvestment — ${name}`,
        created_by_entity: fundEntityUUID,
        date: subscriptionDate,
      }),
    })
    if (fundTxRes.ok) {
      const fundTx: { id: string } = await fundTxRes.json()
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: fundTx.id, entity: fundEntityUUID, entry_type: "cash",
          object_type: "asset", object_id: fundCashAssetId,
          direction: "in", currency: currencyId, amount: netForShares,
          source: "cap", source_id: fundShareholderId,
        }),
      })
    }
  }

  // ── Step 4: Investor portfolio ────────────────────────────────────────────────
  // For reinvestment: money is already in the portfolio (from prior distributions).
  // Two entries only: cash OUT → equity IN. No "new money" entry.
  let investorPortfolioEntityUUID: string | null = null
  let investorCashAssetId: string | null = null
  let fundInvestmentAssetId: string | null = null
  let portfolioSkipReason: string | null = null

  if (userId != null) {
    const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ owner: userId }),
    })
    if (portfoliosRes.ok) {
      const portfolios: Array<{ id: string; entity: string }> = await portfoliosRes.json()
      if (portfolios.length > 0) investorPortfolioEntityUUID = portfolios[0].entity
    }
    if (!investorPortfolioEntityUUID) {
      portfolioSkipReason = "No portfolio found for investor user"
    }
  } else {
    portfolioSkipReason = "Shareholder has no linked user account"
  }

  if (investorPortfolioEntityUUID) {
    const invAssetsRes = await fetch(`${base}/asset?entity=${investorPortfolioEntityUUID}`, { headers: h, cache: "no-store" })
    if (invAssetsRes.ok) {
      const invAssets: AssetRecord[] = await invAssetsRes.json()
      const cashAsset = invAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
      if (cashAsset) investorCashAssetId = cashAsset.id
      // Prefer lookup by entry (precise), fall back to shareholder
      const fundInvAsset =
        invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_entry === entryId) ??
        invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === fundShareholderId)
      if (fundInvAsset) fundInvestmentAssetId = fundInvAsset.id
    }

    if (!fundInvestmentAssetId) {
      portfolioSkipReason = "Could not find equity stake asset in investor portfolio"
    }
  }

  if (investorPortfolioEntityUUID && investorCashAssetId && fundInvestmentAssetId) {
    const invTxRes = await fetch(`${base}/transaction`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        type: subscriptionTypeId,
        reference: `${fundName ?? "Fund"} reinvestment`,
        created_by_entity: investorPortfolioEntityUUID,
        date: subscriptionDate,
      }),
    })
    if (invTxRes.ok) {
      const invTx: { id: string } = await invTxRes.json()
      const grossWire = callAmount + feeAmount

      // Entry 1: New money IN — gross reinvestment amount arrives in portfolio cash
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: invTx.id, entity: investorPortfolioEntityUUID,
          entry_type: "cash", object_type: "asset", object_id: investorCashAssetId,
          direction: "in", currency: currencyId, amount: grossWire,
          source: "new_money_in",
        }),
      })
      // Entry 2: Cash OUT — gross wire leaves cash to fund investment
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: invTx.id, entity: investorPortfolioEntityUUID,
          entry_type: "cash", object_type: "asset", object_id: investorCashAssetId,
          direction: "out", currency: currencyId, amount: grossWire,
          source: "asset", source_id: fundInvestmentAssetId,
        }),
      })
      // Entry 3: Equity IN — net amount added to fund investment asset
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: invTx.id, entity: investorPortfolioEntityUUID,
          entry_type: "equity", object_type: "asset", object_id: fundInvestmentAssetId,
          direction: "in", currency: currencyId, amount: netForShares,
          source: "cash", source_id: investorCashAssetId,
        }),
      })
    }
  }

  return NextResponse.json({
    success: true,
    callId: call.id,
    investorPortfolioEntityUUID,
    fundInvestmentAssetId,
    portfolioSkipReason,
  })
}
