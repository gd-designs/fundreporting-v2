import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

interface Body {
  // Receiving fund (the cap table the new shareholder lives on)
  receivingFundEntityUUID: string
  receivingFundId?: string
  // Investing fund (the fund that owns the position; an asset is created on this fund's entity)
  investingFundId: string
  investingFundEntityUUID: string
  // Display
  name: string
  currencyId?: number
  // Investment + subscription record (optional — if omitted, only shareholder + asset are created)
  shareClassId?: string
  shareClassFeeId?: string
  committedAmount?: number
  recordMode?: "none" | "pending" | "paid"
  callAmount?: number
  subscriptionDate?: number
  entryFeeRateDecimal?: number
  markDeployed?: boolean
}

type AssetRecord = {
  id: string
  entity: string
  asset_class?: number | null
  investable?: string | null
  currency?: number | null
  cap_table_shareholder?: string | null
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as Body
  const {
    receivingFundEntityUUID,
    receivingFundId,
    investingFundId,
    investingFundEntityUUID,
    name,
    currencyId = 1,
    shareClassId,
    shareClassFeeId,
    committedAmount,
    recordMode = "none",
    callAmount,
    subscriptionDate = Date.now(),
    entryFeeRateDecimal = 0,
    markDeployed = false,
  } = body

  if (!receivingFundEntityUUID) return NextResponse.json({ error: "receivingFundEntityUUID required" }, { status: 400 })
  if (!investingFundId || !investingFundEntityUUID) return NextResponse.json({ error: "investingFund required" }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const base = process.env.PLATFORM_API_URL!
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  const feeAmount = (callAmount ?? 0) * (entryFeeRateDecimal ?? 0)
  const netForShares = callAmount ?? 0

  console.log(`[fund-as-investor] ▶ START name="${name}" receiving=${receivingFundEntityUUID} investing=${investingFundEntityUUID} mode=${recordMode}`)

  // ── STEP 1: Create cap_table_shareholder on the receiving fund ──────────────
  const createShRes = await fetch(`${base}/cap_table_shareholder`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      entity: receivingFundEntityUUID,
      name: name.trim(),
      type: "fund",
      role: "investor",
      linked_fund: investingFundId,
    }),
  })
  if (!createShRes.ok) {
    return NextResponse.json(
      { error: "Failed to create fund shareholder", detail: await createShRes.text() },
      { status: 500 }
    )
  }
  const sh = (await createShRes.json()) as { id: string }
  console.log(`[fund-as-investor] STEP 1 — created shareholder id=${sh.id}`)

  // ── STEP 2: Resolve receiving fund metadata for the asset name ──────────────
  let receivingFundName: string | null = null
  let receivingFundCountry: number | null = null
  if (receivingFundId) {
    const fundRes = await fetch(`${base}/fund/${receivingFundId}`, { headers: h, cache: "no-store" })
    if (fundRes.ok) {
      const fund = (await fundRes.json()) as { name?: string | null; country?: number | null }
      receivingFundName = fund.name ?? null
      receivingFundCountry = fund.country ?? null
    }
  }

  // ── STEP 3: Find or create equity stake asset on the investing fund's entity ──
  let assetId: string | null = null
  const assetsRes = await fetch(`${base}/asset?entity=${investingFundEntityUUID}`, { headers: h, cache: "no-store" })
  if (assetsRes.ok) {
    const assets = (await assetsRes.json()) as AssetRecord[]
    const existing = assets.find(
      (a) => a.investable === "equity_stake" && a.cap_table_shareholder === sh.id
    )
    if (existing) {
      assetId = existing.id
      console.log(`[fund-as-investor] STEP 3 — found existing equity stake asset id=${assetId}`)
    }
  }

  if (!assetId) {
    const createAssetRes = await fetch(`${base}/asset`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        entity: investingFundEntityUUID,
        name: receivingFundName ?? name.trim(),
        asset_class: 3,
        currency: currencyId,
        ...(receivingFundCountry != null ? { country: receivingFundCountry } : {}),
        investable: "equity_stake",
        purchased_at: subscriptionDate,
        locked: true,
      }),
    })
    if (!createAssetRes.ok) {
      return NextResponse.json(
        { error: "Failed to create equity stake asset", detail: await createAssetRes.text(), shareholderId: sh.id },
        { status: 500 }
      )
    }
    const asset = (await createAssetRes.json()) as { id: string }
    assetId = asset.id
    console.log(`[fund-as-investor] STEP 3 — created equity stake asset id=${assetId}`)

    await fetch(`${base}/asset/${assetId}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({
        cap_table_shareholder: sh.id,
        ...(receivingFundId ? { fund: receivingFundId } : {}),
      }),
    })
  }

  // ── STEP 4: Cap table entry on the receiving fund ──────────────────────────
  let entryId: string | null = null
  if (recordMode !== "none" || committedAmount != null) {
    const createEntryRes = await fetch(`${base}/cap_table_entry`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        entity: receivingFundEntityUUID,
        shareholder: sh.id,
        share_class: shareClassId || null,
        committed_amount: committedAmount ?? callAmount ?? null,
        issued_at: subscriptionDate,
      }),
    })
    if (!createEntryRes.ok) {
      return NextResponse.json(
        { error: "Failed to create cap table entry", detail: await createEntryRes.text(), shareholderId: sh.id, assetId },
        { status: 500 }
      )
    }
    const entry = (await createEntryRes.json()) as { id: string }
    entryId = entry.id
    console.log(`[fund-as-investor] STEP 4 — created cap table entry id=${entryId}`)

    // Link the equity stake asset to the entry
    if (assetId) {
      await fetch(`${base}/asset/${assetId}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ cap_table_entry: entryId }),
      })
    }
  }

  // ── STEP 5: Capital call ────────────────────────────────────────────────────
  let callId: string | null = null
  if (recordMode !== "none" && entryId && callAmount && callAmount > 0) {
    const status = recordMode === "paid" ? "paid" : "pending"
    const createCallRes = await fetch(`${base}/capital_call`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        entity: receivingFundEntityUUID,
        cap_table_entry: entryId,
        amount: callAmount,
        called_at: subscriptionDate,
        status,
      }),
    })
    if (!createCallRes.ok) {
      return NextResponse.json(
        { error: "Failed to create capital call", detail: await createCallRes.text(), shareholderId: sh.id, assetId, entryId },
        { status: 500 }
      )
    }
    const call = (await createCallRes.json()) as { id: string }
    callId = call.id
    console.log(`[fund-as-investor] STEP 5 — created capital call id=${callId} status=${status}`)

    const callPatch: Record<string, unknown> = { called_at: subscriptionDate }
    if (recordMode === "paid") callPatch.received_at = subscriptionDate
    if (shareClassId) callPatch.share_class = shareClassId
    if (feeAmount > 0) {
      callPatch.fee_amount = feeAmount
      if (shareClassFeeId) callPatch.share_class_fee = shareClassFeeId
    }
    if (markDeployed) callPatch.deployed_at = subscriptionDate
    await fetch(`${base}/capital_call/${callId}`, { method: "PATCH", headers: h, body: JSON.stringify(callPatch) })
  }

  // ── STEP 6: Money movements (only for paid mode) ────────────────────────────
  if (recordMode === "paid" && callAmount && callAmount > 0) {
    // Resolve receiving fund cash asset
    let receivingFundCashAssetId: string | null = null
    const recvAssetsRes = await fetch(`${base}/asset?entity=${receivingFundEntityUUID}`, { headers: h, cache: "no-store" })
    if (recvAssetsRes.ok) {
      const recvAssets = (await recvAssetsRes.json()) as AssetRecord[]
      const cash = recvAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
      if (cash) receivingFundCashAssetId = cash.id
    }
    if (!receivingFundCashAssetId) {
      const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" })
      const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
      const createCashRes = await fetch(`${base}/asset`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          entity: receivingFundEntityUUID,
          asset_class: 1,
          name: currencyName,
          currency: currencyId,
          investable: "investable_cash",
          locked: true,
        }),
      })
      if (createCashRes.ok) receivingFundCashAssetId = ((await createCashRes.json()) as { id: string }).id
    }

    // Resolve investing fund cash asset
    let investingFundCashAssetId: string | null = null
    const invAssetsRes = await fetch(`${base}/asset?entity=${investingFundEntityUUID}`, { headers: h, cache: "no-store" })
    if (invAssetsRes.ok) {
      const invAssets = (await invAssetsRes.json()) as AssetRecord[]
      const cash = invAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
      if (cash) investingFundCashAssetId = cash.id
    }
    if (!investingFundCashAssetId) {
      const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" })
      const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
      const createCashRes = await fetch(`${base}/asset`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          entity: investingFundEntityUUID,
          asset_class: 1,
          name: currencyName,
          currency: currencyId,
          investable: "investable_cash",
          locked: true,
        }),
      })
      if (createCashRes.ok) investingFundCashAssetId = ((await createCashRes.json()) as { id: string }).id
    }

    // Resolve subscription transaction type
    let subscriptionTypeId: number | null = null
    const ttRes = await fetch(`${base}/transaction_type`, { headers: h, cache: "no-store" })
    if (ttRes.ok) {
      const ttList = (await ttRes.json()) as Array<{ id: number; name?: string }>
      const sub = ttList.find((t) => t.name?.toLowerCase() === "subscription")
      const buy = ttList.find((t) => t.name?.toLowerCase() === "buy")
      subscriptionTypeId = sub?.id ?? buy?.id ?? null
    }

    const grossWire = callAmount + feeAmount

    // Investing fund tx — cash OUT + equity IN (mirrors company → fund step)
    if (investingFundCashAssetId && assetId) {
      const txRes = await fetch(`${base}/transaction`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          type: subscriptionTypeId,
          reference: `${receivingFundName ?? "Fund"} subscription`,
          created_by_entity: investingFundEntityUUID,
          date: subscriptionDate,
        }),
      })
      if (txRes.ok) {
        const tx = (await txRes.json()) as { id: string }
        console.log(`[fund-as-investor] STEP 6 — investing fund tx id=${tx.id}`)
        await fetch(`${base}/transaction_entry`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            transaction: tx.id, entity: investingFundEntityUUID,
            entry_type: "cash", object_type: "asset", object_id: investingFundCashAssetId,
            direction: "out", currency: currencyId, amount: grossWire,
            source: "asset", source_id: assetId,
          }),
        })
        await fetch(`${base}/transaction_entry`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            transaction: tx.id, entity: investingFundEntityUUID,
            entry_type: "equity", object_type: "asset", object_id: assetId,
            direction: "in", currency: currencyId, amount: netForShares,
            source: "cash", source_id: investingFundCashAssetId,
          }),
        })
      }
    }

    // Receiving fund tx — cash IN
    if (receivingFundCashAssetId) {
      const txRes = await fetch(`${base}/transaction`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          type: subscriptionTypeId,
          reference: `Subscription — ${name}`,
          created_by_entity: receivingFundEntityUUID,
          date: subscriptionDate,
        }),
      })
      if (txRes.ok) {
        const tx = (await txRes.json()) as { id: string }
        console.log(`[fund-as-investor] STEP 6 — receiving fund tx id=${tx.id}`)
        await fetch(`${base}/transaction_entry`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            transaction: tx.id, entity: receivingFundEntityUUID,
            entry_type: "cash", object_type: "asset", object_id: receivingFundCashAssetId,
            direction: "in", currency: currencyId, amount: netForShares,
            source: "cap", source_id: sh.id,
          }),
        })
      }
    }
  }

  console.log(`[fund-as-investor] ✓ DONE shareholder=${sh.id} asset=${assetId} entry=${entryId} call=${callId}`)

  return NextResponse.json({
    success: true,
    shareholderId: sh.id,
    assetId,
    entryId,
    callId,
  })
}
