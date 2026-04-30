import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

type AssetRecord = {
  id: string
  entity?: string | null
  asset_class?: number | null
  investable?: string | null
  currency?: number | null
}

type FundFee = {
  id: string
  entity?: string | null
  cap_table_entry?: string | null
  amount?: number | null
  share_class_fee?: string | null
}

type CapTableEntry = {
  id: string
  shareholder?: string | null
  share_class?: string | null
}

type ShareClass = {
  id: string
  name?: string | null
}

type ShareClassFee = {
  id: string
  type?: "management" | "performance" | "entry" | "exit" | "administration" | "setup" | "other" | null
}

/**
 * POST /api/fund-fee-pay
 * Body: { id: string; date?: number }
 * Marks a fund_fee record as paid and records the cash movement:
 * - Cash OUT on the fund (this fee leaves the fund's bank account to the manager)
 */
export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, date } = (await req.json()) as { id: string; date?: number }
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const base = process.env.PLATFORM_API_URL!
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // 1. Fetch the fee
  const feeRes = await fetch(`${base}/fund_fee/${id}`, { headers: h, cache: "no-store" })
  if (!feeRes.ok) return NextResponse.json({ error: "Fund fee not found" }, { status: 404 })
  const fee = (await feeRes.json()) as FundFee

  const fundEntityUUID = fee.entity
  const amount = fee.amount ?? 0
  if (!fundEntityUUID || amount <= 0) {
    return NextResponse.json({ error: "Invalid fee — missing entity or amount" }, { status: 400 })
  }

  const now = date ?? Date.now()

  // 2. Mark as paid
  await fetch(`${base}/fund_fee/${id}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ status: "paid", paid_at: now }),
  })

  // 3. Resolve fund cash asset (default to first cash asset; doesn't filter by currency)
  let fundCashAssetId: string | null = null
  let fundCashCurrency: number | null = null
  const fundAssetsRes = await fetch(`${base}/asset?entity=${fundEntityUUID}`, { headers: h, cache: "no-store" })
  if (fundAssetsRes.ok) {
    const fundAssets = (await fundAssetsRes.json()) as AssetRecord[]
    const cash = fundAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash")
    if (cash) {
      fundCashAssetId = cash.id
      fundCashCurrency = cash.currency ?? null
    }
  }

  // 4. Resolve the shareholder for source linkage (which investor's share was charged the fee)
  let shareholderId: string | null = null
  if (fee.cap_table_entry) {
    const entryRes = await fetch(`${base}/cap_table_entry/${fee.cap_table_entry}`, { headers: h, cache: "no-store" })
    if (entryRes.ok) {
      const entry = (await entryRes.json()) as CapTableEntry
      shareholderId = entry.shareholder ?? null
    }
  }

  // 5. Resolve the fee type label for the transaction reference
  let feeTypeLabel = "Fee"
  if (fee.share_class_fee) {
    const scfRes = await fetch(`${base}/share_class_fee/${fee.share_class_fee}`, { headers: h, cache: "no-store" })
    if (scfRes.ok) {
      const scf = (await scfRes.json()) as ShareClassFee
      if (scf.type === "management") feeTypeLabel = "Management fee"
      else if (scf.type === "performance") feeTypeLabel = "Performance fee"
      else if (scf.type) feeTypeLabel = `${scf.type[0].toUpperCase()}${scf.type.slice(1)} fee`
    }
  }

  // 6. Find a transaction type — prefer "fee" or "expense", fall back to a generic id
  let txTypeId: number | null = null
  const ttRes = await fetch(`${base}/transaction_type`, { headers: h, cache: "no-store" })
  if (ttRes.ok) {
    const tt = (await ttRes.json()) as Array<{ id: number; name?: string }>
    txTypeId = tt.find((t) => t.name?.toLowerCase() === "fee")?.id
      ?? tt.find((t) => t.name?.toLowerCase() === "expense")?.id
      ?? tt.find((t) => t.name?.toLowerCase() === "distribution")?.id
      ?? null
  }

  // 7. Cash OUT on fund
  let fundTxId: string | null = null
  if (fundCashAssetId) {
    const txRes = await fetch(`${base}/transaction`, {
      method: "POST", headers: h,
      body: JSON.stringify({
        type: txTypeId,
        reference: `${feeTypeLabel} paid`,
        created_by_entity: fundEntityUUID,
        date: now,
      }),
    })
    if (txRes.ok) {
      const tx = (await txRes.json()) as { id: string }
      fundTxId = tx.id
      await fetch(`${base}/transaction_entry`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          transaction: tx.id,
          entity: fundEntityUUID,
          entry_type: "cash",
          object_type: "asset",
          object_id: fundCashAssetId,
          direction: "out",
          ...(fundCashCurrency != null ? { currency: fundCashCurrency } : {}),
          amount,
          ...(shareholderId ? { source: "cap", source_id: shareholderId } : {}),
        }),
      })
    }
  }

  // 8. Mirror on the asset manager's books — fee revenue, cash IN.
  // Resolve fund record → asset_manager record → asset_manager entity.
  let amEntityUUID: string | null = null
  let fundName: string | null = null
  const fundLookupRes = await fetch(`${base}/fund?entity=${fundEntityUUID}`, { headers: h, cache: "no-store" })
  if (fundLookupRes.ok) {
    const list = (await fundLookupRes.json()) as Array<{ name?: string | null; managed_by?: string | null }>
    const fundRec = list[0]
    if (fundRec) {
      fundName = fundRec.name ?? null
      if (fundRec.managed_by) {
        const amRes = await fetch(`${base}/asset_manager/${fundRec.managed_by}`, { headers: h, cache: "no-store" })
        if (amRes.ok) {
          const am = (await amRes.json()) as { entity?: string | null }
          amEntityUUID = am.entity ?? null
        }
      }
    }
  }

  let amTxId: string | null = null
  let amCashAssetId: string | null = null
  if (amEntityUUID) {
    // Resolve / create AM cash asset matching the fund's currency.
    const amAssetsRes = await fetch(`${base}/asset?entity=${amEntityUUID}`, { headers: h, cache: "no-store" })
    if (amAssetsRes.ok) {
      const amAssets = (await amAssetsRes.json()) as AssetRecord[]
      const cash = amAssets.find(
        (a) => a.asset_class === 1 && a.investable === "investable_cash"
          && (fundCashCurrency == null || a.currency === fundCashCurrency),
      )
      if (cash) amCashAssetId = cash.id
    }
    if (!amCashAssetId && fundCashCurrency != null) {
      const currencyRes = await fetch(`${base}/currency/${fundCashCurrency}`, { headers: h, cache: "no-store" })
      const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
      const createRes = await fetch(`${base}/asset`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          entity: amEntityUUID,
          asset_class: 1,
          name: currencyName,
          currency: fundCashCurrency,
          investable: "investable_cash",
          locked: true,
        }),
      })
      if (createRes.ok) amCashAssetId = ((await createRes.json()) as { id: string }).id
    }

    if (amCashAssetId) {
      const amTxRes = await fetch(`${base}/transaction`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          type: txTypeId,
          reference: `${feeTypeLabel} received${fundName ? ` from ${fundName}` : ""}`,
          created_by_entity: amEntityUUID,
          date: now,
        }),
      })
      if (amTxRes.ok) {
        const amTx = (await amTxRes.json()) as { id: string }
        amTxId = amTx.id
        await fetch(`${base}/transaction_entry`, {
          method: "POST", headers: h,
          body: JSON.stringify({
            transaction: amTx.id,
            entity: amEntityUUID,
            entry_type: "cash",
            object_type: "asset",
            object_id: amCashAssetId,
            direction: "in",
            ...(fundCashCurrency != null ? { currency: fundCashCurrency } : {}),
            amount,
          }),
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    feeId: id,
    fundTransactionId: fundTxId,
    fundCashAssetId,
    amEntityUUID,
    amTransactionId: amTxId,
    amCashAssetId,
  })
}
