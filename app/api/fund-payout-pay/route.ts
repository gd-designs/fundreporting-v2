import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

type AssetRecord = {
  id: string
  asset_class?: number | null
  investable?: string | null
  currency?: number | null
}

/**
 * POST /api/fund-payout-pay
 * Body: { id: string }
 * Marks a payout as paid and records the cash movements:
 * 1. Cash OUT on the fund
 * 2. Cash IN on the investor's entity (portfolio / company / fund)
 */
export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, date } = (await req.json()) as { id: string; date?: number }
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const base = process.env.PLATFORM_API_URL!
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // 1. Fetch the payout
  const payoutRes = await fetch(`${base}/fund_payout/${id}`, { headers: h, cache: "no-store" })
  if (!payoutRes.ok) return NextResponse.json({ error: "Payout not found" }, { status: 404 })
  const payout = (await payoutRes.json()) as {
    id: string
    entity?: string | null
    cap_table_entry?: string | null
    amount?: number | null
    type?: string | null
  }

  const fundEntityUUID = payout.entity
  const amount = payout.amount ?? 0
  if (!fundEntityUUID || amount <= 0) {
    return NextResponse.json({ error: "Invalid payout — missing entity or amount" }, { status: 400 })
  }

  const now = date ?? Date.now()

  // 2. Mark as paid
  await fetch(`${base}/fund_payout/${id}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ status: "paid", paid_at: now }),
  })

  // 3. Resolve fund cash asset
  let fundCashAssetId: string | null = null
  const fundAssetsRes = await fetch(`${base}/asset?entity=${fundEntityUUID}`, { headers: h, cache: "no-store" })
  if (fundAssetsRes.ok) {
    const fundAssets = (await fundAssetsRes.json()) as AssetRecord[]
    const cash = fundAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash")
    if (cash) fundCashAssetId = cash.id
  }

  // 4. Resolve the investor's shareholder to find their entity
  let investorEntityUUID: string | null = null
  let investorShareholderId: string | null = null

  if (payout.cap_table_entry) {
    const entryRes = await fetch(`${base}/cap_table_entry/${payout.cap_table_entry}`, { headers: h, cache: "no-store" })
    if (entryRes.ok) {
      const entry = (await entryRes.json()) as { shareholder?: string | null }
      if (entry.shareholder) {
        investorShareholderId = entry.shareholder
        const shRes = await fetch(`${base}/cap_table_shareholder/${entry.shareholder}`, { headers: h, cache: "no-store" })
        if (shRes.ok) {
          const sh = (await shRes.json()) as {
            type?: string | null
            user?: number | null
            parent_shareholder?: string | null
            linked_fund?: string | null
          }

          if (sh.type === "fund" && sh.linked_fund) {
            // Fund investor — entity is on the investing fund
            const fundRes = await fetch(`${base}/fund/${sh.linked_fund}`, { headers: h, cache: "no-store" })
            if (fundRes.ok) {
              const fund = (await fundRes.json()) as { entity?: string | null }
              investorEntityUUID = typeof fund.entity === "string" ? fund.entity : null
            }
          } else {
            // Individual/company — find personal portfolio
            let userId = sh.user ?? null
            if (userId == null && sh.parent_shareholder) {
              const parentRes = await fetch(`${base}/cap_table_shareholder/${sh.parent_shareholder}`, { headers: h, cache: "no-store" })
              if (parentRes.ok) {
                const parent = (await parentRes.json()) as { user?: number | null }
                userId = parent.user ?? null
              }
            }
            if (userId != null) {
              const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, {
                method: "POST", headers: h, body: JSON.stringify({ owner: userId }),
              })
              if (portfoliosRes.ok) {
                const portfolios = (await portfoliosRes.json()) as Array<{ entity: string }>
                investorEntityUUID = portfolios[0]?.entity ?? null
              }
            }
          }
        }
      }
    }
  }

  // 5. Find transaction type (Distribution = 9)
  const txTypeId = 9

  // 6. Fund cash OUT
  if (fundCashAssetId) {
    const txRes = await fetch(`${base}/transaction`, {
      method: "POST", headers: h,
      body: JSON.stringify({
        type: txTypeId,
        reference: `${payout.type === "redemption" ? "Redemption" : "Distribution"} payout`,
        created_by_entity: fundEntityUUID,
        date: now,
      }),
    })
    if (txRes.ok) {
      const tx = (await txRes.json()) as { id: string }
      await fetch(`${base}/transaction_entry`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          transaction: tx.id, entity: fundEntityUUID,
          entry_type: "cash", object_type: "asset", object_id: fundCashAssetId,
          direction: "out", amount,
          source: "cap", source_id: investorShareholderId,
        }),
      })
      console.log(`[payout-pay] fund cash OUT tx=${tx.id} amount=${amount}`)
    }
  }

  // 7. Investor cash IN
  if (investorEntityUUID) {
    // Find or create investor's cash asset (match currency from fund's cash asset)
    let investorCashAssetId: string | null = null
    const fundCashCurrency = fundCashAssetId
      ? (await fetch(`${base}/asset/${fundCashAssetId}`, { headers: h, cache: "no-store" })
          .then((r) => r.ok ? r.json() : null)
          .then((a: { currency?: number | null } | null) => a?.currency ?? 1))
      : 1

    const invAssetsRes = await fetch(`${base}/asset?entity=${investorEntityUUID}`, { headers: h, cache: "no-store" })
    if (invAssetsRes.ok) {
      const invAssets = (await invAssetsRes.json()) as AssetRecord[]
      const cash = invAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === fundCashCurrency)
      if (cash) investorCashAssetId = cash.id
    }

    if (!investorCashAssetId) {
      // Create cash asset on investor entity
      const currencyRes = await fetch(`${base}/currency/${fundCashCurrency}`, { headers: h, cache: "no-store" })
      const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
      const createRes = await fetch(`${base}/asset`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          entity: investorEntityUUID, asset_class: 1, name: currencyName,
          currency: fundCashCurrency, investable: "investable_cash", locked: true,
        }),
      })
      if (createRes.ok) investorCashAssetId = ((await createRes.json()) as { id: string }).id
    }

    if (investorCashAssetId) {
      const txRes = await fetch(`${base}/transaction`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          type: txTypeId,
          reference: `${payout.type === "redemption" ? "Redemption" : "Distribution"} received`,
          created_by_entity: investorEntityUUID,
          date: now,
        }),
      })
      if (txRes.ok) {
        const tx = (await txRes.json()) as { id: string }
        await fetch(`${base}/transaction_entry`, {
          method: "POST", headers: h,
          body: JSON.stringify({
            transaction: tx.id, entity: investorEntityUUID,
            entry_type: "cash", object_type: "asset", object_id: investorCashAssetId,
            direction: "in", amount,
            source: "cap", source_id: investorShareholderId,
          }),
        })
        console.log(`[payout-pay] investor cash IN tx=${tx.id} entity=${investorEntityUUID} amount=${amount}`)
      }
    }
  }

  console.log(`[payout-pay] ✓ id=${id} fundCash=${fundCashAssetId ?? "none"} investorEntity=${investorEntityUUID ?? "none"}`)
  return NextResponse.json({ success: true, fundCashOut: !!fundCashAssetId, investorCashIn: !!investorEntityUUID, investorEntityUUID })
}
