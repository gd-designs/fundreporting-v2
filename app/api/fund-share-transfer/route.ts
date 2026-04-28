import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

type AssetRecord = {
  id: string
  entity?: string | null
  asset_class?: number | null
  investable?: string | null
  currency?: number | null
  cap_table_shareholder?: string | null
  cap_table_entry?: string | null
  fund?: string | null
  name?: string | null
}

type Shareholder = {
  id: string
  type?: string | null
  user?: number | null
  parent_shareholder?: string | null
  linked_fund?: string | null
  name?: string | null
}

interface Body {
  shareTransferId: string
  currencyId?: number
}

export async function POST(req: NextRequest) {
  // Two ways to authenticate:
  // 1. User session token (cookie) — for the manual "Execute now" button
  // 2. Shared secret header — for the Xano cron task that auto-executes due transfers
  const cronSecret = req.headers.get("x-cron-secret")
  const expectedSecret = process.env.SHARE_TRANSFER_CRON_SECRET
  const isCron = !!expectedSecret && cronSecret === expectedSecret

  let token: string | null | undefined = null
  if (!isCron) {
    token = await getAuthToken()
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  } else {
    // Cron uses a service token from env to talk to Xano
    token = process.env.PLATFORM_SERVICE_TOKEN ?? null
    if (!token) return NextResponse.json({ error: "Service token not configured" }, { status: 500 })
  }

  const body: Body = await req.json()
  const { shareTransferId, currencyId = 1 } = body
  if (!shareTransferId) {
    return NextResponse.json({ error: "shareTransferId is required" }, { status: 400 })
  }

  const base = process.env.PLATFORM_API_URL!
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // Load the pending share_transfer record
  const stRecordRes = await fetch(`${base}/share_transfer/${shareTransferId}`, { headers: h, cache: "no-store" })
  if (!stRecordRes.ok) {
    return NextResponse.json({ error: "Share transfer record not found" }, { status: 404 })
  }
  const stRecord = (await stRecordRes.json()) as {
    id: string
    entity?: string | null
    seller_cap_table_entry?: string | null
    buyer_cap_table_entry?: string | null
    shares?: number | null
    amount?: number | null
    nav_per_share?: number | null
    transferred_at?: number | null
    status?: string | null
  }
  if (stRecord.status && stRecord.status !== "pending") {
    return NextResponse.json({ error: `Share transfer is already ${stRecord.status}` }, { status: 409 })
  }

  const fundEntityUUID = stRecord.entity ?? ""
  const sellerEntryId = stRecord.seller_cap_table_entry ?? ""
  const buyerEntryId = stRecord.buyer_cap_table_entry ?? ""
  const shares = stRecord.shares ?? 0
  const amount = stRecord.amount ?? 0
  const date = stRecord.transferred_at ?? Date.now()

  if (!fundEntityUUID || !sellerEntryId || !buyerEntryId) {
    return NextResponse.json({ error: "Share transfer record is missing required fields" }, { status: 400 })
  }
  if (shares <= 0 || amount <= 0) {
    return NextResponse.json({ error: "shares and amount must be positive" }, { status: 400 })
  }
  if (sellerEntryId === buyerEntryId) {
    return NextResponse.json({ error: "seller and buyer must differ" }, { status: 400 })
  }

  const navPerShare = stRecord.nav_per_share ?? amount / shares

  // ── Fetch entries + shareholders ────────────────────────────────────────
  const [sellerEntryRes, buyerEntryRes] = await Promise.all([
    fetch(`${base}/cap_table_entry/${sellerEntryId}`, { headers: h, cache: "no-store" }),
    fetch(`${base}/cap_table_entry/${buyerEntryId}`, { headers: h, cache: "no-store" }),
  ])
  if (!sellerEntryRes.ok || !buyerEntryRes.ok) {
    return NextResponse.json({ error: "Failed to fetch cap table entries" }, { status: 400 })
  }
  const sellerEntry = (await sellerEntryRes.json()) as { shareholder?: string | null; share_class?: string | null }
  const buyerEntry = (await buyerEntryRes.json()) as { shareholder?: string | null; share_class?: string | null }
  const sellerShId = sellerEntry.shareholder
  const buyerShId = buyerEntry.shareholder
  if (!sellerShId || !buyerShId) {
    return NextResponse.json({ error: "Missing shareholder on one of the entries" }, { status: 400 })
  }

  const [sellerShRes, buyerShRes] = await Promise.all([
    fetch(`${base}/cap_table_shareholder/${sellerShId}`, { headers: h, cache: "no-store" }),
    fetch(`${base}/cap_table_shareholder/${buyerShId}`, { headers: h, cache: "no-store" }),
  ])
  const sellerSh = (await sellerShRes.json()) as Shareholder
  const buyerSh = (await buyerShRes.json()) as Shareholder

  // Transaction type IDs
  let subscriptionTypeId: number | null = null
  let redemptionTypeId: number | null = null
  const ttRes = await fetch(`${base}/transaction_type`, { headers: h, cache: "no-store" })
  if (ttRes.ok) {
    const tt: Array<{ id: number; name?: string }> = await ttRes.json()
    subscriptionTypeId = tt.find((t) => t.name?.toLowerCase() === "subscription")?.id
      ?? tt.find((t) => t.name?.toLowerCase() === "buy")?.id ?? null
    redemptionTypeId = tt.find((t) => t.name?.toLowerCase() === "redemption")?.id
      ?? tt.find((t) => t.name?.toLowerCase() === "distribution")?.id ?? null
  }

  // ── Phase 1: fund-level share mutations ────────────────────────────────
  console.log(`[share-transfer] Phase 1 — fund mutations (shares=${shares} amount=${amount} nav=${navPerShare})`)
  const sellerMutRes = await fetch(`${base}/fund_mutation`, {
    method: "POST", headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID, cap_table_entry: sellerEntryId, type: "redemption",
      shares_redeemed: shares, amount_returned: amount, nav_per_share: navPerShare,
      mutation_at: date, notes: `Transfer to ${buyerSh.name ?? buyerShId}`,
    }),
  })
  const buyerMutRes = await fetch(`${base}/fund_mutation`, {
    method: "POST", headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID, cap_table_entry: buyerEntryId, type: "subscription",
      shares_issued: shares, amount_invested: amount, amount_for_shares: amount,
      nav_per_share: navPerShare, mutation_at: date, notes: `Transfer from ${sellerSh.name ?? sellerShId}`,
    }),
  })
  if (!sellerMutRes.ok || !buyerMutRes.ok) {
    return NextResponse.json({ error: "Failed to record fund mutations" }, { status: 500 })
  }
  const sellerMutation = (await sellerMutRes.json()) as { id: string }
  const buyerMutation = (await buyerMutRes.json()) as { id: string }

  // ── Helpers ────────────────────────────────────────────────────────────
  async function findStakeAsset(entryId: string, shId: string): Promise<AssetRecord | null> {
    // Query by cap_table_shareholder (strongest link). Fall back to entry.
    const res = await fetch(`${base}/asset?cap_table_shareholder=${shId}`, { headers: h, cache: "no-store" })
    if (!res.ok) return null
    const list = (await res.json()) as AssetRecord[]
    return list.find((a) => a.investable === "equity_stake" && a.cap_table_entry === entryId)
      ?? list.find((a) => a.investable === "equity_stake") ?? null
  }

  async function findOrCreateCashAsset(entity: string): Promise<string | null> {
    const res = await fetch(`${base}/asset?entity=${entity}`, { headers: h, cache: "no-store" })
    if (res.ok) {
      const list = (await res.json()) as AssetRecord[]
      const cash = list.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
      if (cash) return cash.id
    }
    const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" })
    const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
    const createRes = await fetch(`${base}/asset`, {
      method: "POST", headers: h,
      body: JSON.stringify({
        entity, asset_class: 1, name: currencyName, currency: currencyId,
        investable: "investable_cash", locked: true,
      }),
    })
    if (!createRes.ok) return null
    return ((await createRes.json()) as { id: string }).id
  }

  async function findOrCreateFundStakeAsset(entity: string, entryId: string, shId: string, fundName: string): Promise<string | null> {
    const res = await fetch(`${base}/asset?entity=${entity}`, { headers: h, cache: "no-store" })
    if (res.ok) {
      const list = (await res.json()) as AssetRecord[]
      const existing = list.find((a) => a.investable === "equity_stake" && a.cap_table_entry === entryId)
        ?? list.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === shId)
      if (existing) return existing.id
    }
    const createRes = await fetch(`${base}/asset`, {
      method: "POST", headers: h,
      body: JSON.stringify({
        entity, name: fundName, asset_class: 3, currency: currencyId,
        investable: "equity_stake", purchased_at: date, locked: true,
      }),
    })
    if (!createRes.ok) return null
    const asset = (await createRes.json()) as { id: string }
    await fetch(`${base}/asset/${asset.id}`, {
      method: "PATCH", headers: h,
      body: JSON.stringify({ cap_table_shareholder: shId, cap_table_entry: entryId }),
    })
    return asset.id
  }

  async function resolvePortfolioEntity(userId: number): Promise<string | null> {
    const res = await fetch(`${base}/portfolio/by-owner`, {
      method: "POST", headers: h, body: JSON.stringify({ owner: userId }),
    })
    if (!res.ok) return null
    const list = (await res.json()) as Array<{ entity: string }>
    return list[0]?.entity ?? null
  }

  async function resolveCompanyEntityForShareholder(sh: Shareholder): Promise<string | null> {
    // A company shareholder has type=company and user=UBO. Find the UBO's company entity
    // that matches by name; fall back to single-company owner.
    if (sh.user == null) return null
    const res = await fetch(`${base}/company/by-owner`, {
      method: "POST", headers: h, body: JSON.stringify({ owner: sh.user }),
    })
    if (!res.ok) return null
    const list = (await res.json()) as Array<{ id: string; _company?: { name?: string | null } | null }>
    const match = list.find((c) => c._company?.name?.toLowerCase() === sh.name?.toLowerCase())
      ?? (list.length === 1 ? list[0] : null)
    return match?.id ?? null
  }

  async function postEntry(txId: string, entity: string, e: Record<string, unknown>) {
    await fetch(`${base}/transaction_entry`, {
      method: "POST", headers: h,
      body: JSON.stringify({ transaction: txId, entity, currency: currencyId, ...e }),
    })
  }

  async function createTransaction(entity: string, reference: string, typeId: number | null): Promise<string | null> {
    const res = await fetch(`${base}/transaction`, {
      method: "POST", headers: h,
      body: JSON.stringify({ type: typeId, reference, created_by_entity: entity, date }),
    })
    if (!res.ok) return null
    return ((await res.json()) as { id: string }).id
  }

  // Fetch fund info for asset naming
  const fundRes = await fetch(`${base}/fund?entity=${fundEntityUUID}`, { headers: h, cache: "no-store" })
  const fundList = fundRes.ok ? ((await fundRes.json()) as Array<{ name?: string | null }>) : []
  const fundName = fundList[0]?.name ?? "Fund Investment"

  // ── Phase 2: seller side — cash IN + equity OUT on stake-holding entity ─
  console.log(`[share-transfer] Phase 2 — seller side (shareholder=${sellerShId})`)
  const sellerStake = await findStakeAsset(sellerEntryId, sellerShId)
  let sellerCashAssetId: string | null = null
  let sellerTxId: string | null = null
  if (!sellerStake?.entity) {
    console.warn(`[share-transfer] Seller stake asset not found — skipping seller ledger entries`)
  } else {
    sellerCashAssetId = await findOrCreateCashAsset(sellerStake.entity)
    sellerTxId = await createTransaction(sellerStake.entity, `Share transfer — sold to ${buyerSh.name ?? "investor"}`, redemptionTypeId)
    if (sellerTxId && sellerCashAssetId) {
      // Cash IN (proceeds from buyer)
      await postEntry(sellerTxId, sellerStake.entity, {
        entry_type: "cash", object_type: "asset", object_id: sellerCashAssetId,
        direction: "in", amount, source: "cap", source_id: buyerShId,
      })
      // Equity OUT (stake reduction)
      await postEntry(sellerTxId, sellerStake.entity, {
        entry_type: "equity", object_type: "asset", object_id: sellerStake.id,
        direction: "out", amount, source: "cash", source_id: sellerCashAssetId,
      })
    }
  }

  // ── Phase 3: buyer side — full chain ────────────────────────────────────
  console.log(`[share-transfer] Phase 3 — buyer side (shareholder=${buyerShId}, type=${buyerSh.type})`)
  const buyerResult: {
    stakeEntityUUID: string | null
    stakeAssetId: string | null
    personalTxId: string | null
    companyCashInTxId: string | null
    companySubTxId: string | null
  } = { stakeEntityUUID: null, stakeAssetId: null, personalTxId: null, companyCashInTxId: null, companySubTxId: null }

  // Resolve UBO user id (for individual or company shareholder)
  let buyerUserId = buyerSh.user ?? null
  if (buyerUserId == null && buyerSh.parent_shareholder) {
    const parentRes = await fetch(`${base}/cap_table_shareholder/${buyerSh.parent_shareholder}`, { headers: h, cache: "no-store" })
    if (parentRes.ok) buyerUserId = ((await parentRes.json()) as Shareholder).user ?? null
  }

  if (buyerSh.type === "company" && buyerUserId != null) {
    // Company-backed buyer: personal → company → fund stake
    const personalEntity = await resolvePortfolioEntity(buyerUserId)
    const companyEntity = await resolveCompanyEntityForShareholder(buyerSh)
    if (!personalEntity || !companyEntity) {
      console.warn(`[share-transfer] Buyer company chain incomplete — personal=${personalEntity} company=${companyEntity}`)
    } else {
      const personalCash = await findOrCreateCashAsset(personalEntity)
      const companyCash = await findOrCreateCashAsset(companyEntity)
      const companyStake = await findOrCreateFundStakeAsset(companyEntity, buyerEntryId, buyerShId, fundName)
      // Company equity asset on personal portfolio (the UBO's holding in the company)
      // Try to reuse an existing one; create linked if missing.
      let personalCompanyEquityId: string | null = null
      const personalAssetsRes = await fetch(`${base}/asset?entity=${personalEntity}`, { headers: h, cache: "no-store" })
      if (personalAssetsRes.ok) {
        const list = (await personalAssetsRes.json()) as AssetRecord[]
        personalCompanyEquityId = list.find((a) => a.investable === "equity_stake" && a.name?.toLowerCase() === buyerSh.name?.toLowerCase())?.id ?? null
      }
      if (!personalCompanyEquityId) {
        const createEq = await fetch(`${base}/asset`, {
          method: "POST", headers: h,
          body: JSON.stringify({
            entity: personalEntity, name: buyerSh.name ?? "Company", asset_class: 3,
            currency: currencyId, investable: "equity_stake", purchased_at: date, locked: true,
          }),
        })
        if (createEq.ok) personalCompanyEquityId = ((await createEq.json()) as { id: string }).id
      }

      buyerResult.stakeEntityUUID = companyEntity
      buyerResult.stakeAssetId = companyStake

      // Look up UBO's shareholder record inside the company (mirrors reinvest)
      let uboShareholderId: string | null = null
      const uboLookupRes = await fetch(`${base}/cap_table_shareholder/lookup`, {
        method: "POST", headers: h,
        body: JSON.stringify({ entity: companyEntity, user_id: buyerUserId }),
      })
      if (uboLookupRes.ok) {
        const uboSh: { id?: string } | null = await uboLookupRes.json().catch(() => null)
        if (uboSh?.id) uboShareholderId = uboSh.id
      }

      if (personalCash && companyCash && companyStake && personalCompanyEquityId) {
        // Personal portfolio: new_money_in → cash OUT → equity IN on companyEquity (mirrors reinvest)
        buyerResult.personalTxId = await createTransaction(personalEntity, `Share transfer funding — ${buyerSh.name}`, subscriptionTypeId)
        if (buyerResult.personalTxId) {
          await postEntry(buyerResult.personalTxId, personalEntity, {
            entry_type: "cash", object_type: "asset", object_id: personalCash,
            direction: "in", amount, source: "new_money_in",
          })
          await postEntry(buyerResult.personalTxId, personalEntity, {
            entry_type: "cash", object_type: "asset", object_id: personalCash,
            direction: "out", amount, source: "asset", source_id: personalCompanyEquityId,
          })
          await postEntry(buyerResult.personalTxId, personalEntity, {
            entry_type: "equity", object_type: "asset", object_id: personalCompanyEquityId,
            direction: "in", amount, source: "cash", source_id: personalCash,
          })
        }
        // Company: UBO cash IN (source: cap → UBO's shareholder in the company)
        if (uboShareholderId) {
          buyerResult.companyCashInTxId = await createTransaction(companyEntity, `UBO funding — share transfer`, subscriptionTypeId)
          if (buyerResult.companyCashInTxId) {
            await postEntry(buyerResult.companyCashInTxId, companyEntity, {
              entry_type: "cash", object_type: "asset", object_id: companyCash,
              direction: "in", amount, source: "cap", source_id: uboShareholderId,
            })
          }
        } else {
          console.warn(`[share-transfer] UBO shareholder not found in company — skipping UBO cash IN`)
        }
        // Company: cash OUT + fund equity IN (mirrors reinvest)
        buyerResult.companySubTxId = await createTransaction(companyEntity, `Share transfer — bought from ${sellerSh.name ?? "investor"}`, subscriptionTypeId)
        if (buyerResult.companySubTxId) {
          await postEntry(buyerResult.companySubTxId, companyEntity, {
            entry_type: "cash", object_type: "asset", object_id: companyCash,
            direction: "out", amount, source: "asset", source_id: companyStake,
          })
          await postEntry(buyerResult.companySubTxId, companyEntity, {
            entry_type: "equity", object_type: "asset", object_id: companyStake,
            direction: "in", amount, source: "cash", source_id: companyCash,
          })
        }
      }
    }
  } else if (buyerUserId != null) {
    // Individual buyer: stake sits on personal portfolio
    const personalEntity = await resolvePortfolioEntity(buyerUserId)
    if (!personalEntity) {
      console.warn(`[share-transfer] Buyer personal portfolio not found for user=${buyerUserId}`)
    } else {
      const personalCash = await findOrCreateCashAsset(personalEntity)
      const fundStake = await findOrCreateFundStakeAsset(personalEntity, buyerEntryId, buyerShId, fundName)
      buyerResult.stakeEntityUUID = personalEntity
      buyerResult.stakeAssetId = fundStake
      if (personalCash && fundStake) {
        // Mirrors reinvest individual flow exactly (no capital_call).
        buyerResult.personalTxId = await createTransaction(personalEntity, `Share transfer — bought from ${sellerSh.name ?? "investor"}`, subscriptionTypeId)
        if (buyerResult.personalTxId) {
          await postEntry(buyerResult.personalTxId, personalEntity, {
            entry_type: "cash", object_type: "asset", object_id: personalCash,
            direction: "in", amount, source: "new_money_in",
          })
          await postEntry(buyerResult.personalTxId, personalEntity, {
            entry_type: "cash", object_type: "asset", object_id: personalCash,
            direction: "out", amount, source: "asset", source_id: fundStake,
          })
          await postEntry(buyerResult.personalTxId, personalEntity, {
            entry_type: "equity", object_type: "asset", object_id: fundStake,
            direction: "in", amount, source: "cash", source_id: personalCash,
          })
        }
      }
    }
  } else {
    console.warn(`[share-transfer] Buyer has no resolvable user — skipping buyer ledger`)
  }

  // ── Phase 4: flip share_transfer from pending → executed ────────────────
  const patchRes = await fetch(`${base}/share_transfer/${shareTransferId}`, {
    method: "PATCH", headers: h,
    body: JSON.stringify({
      status: "executed",
      seller_mutation: sellerMutation.id,
      buyer_mutation: buyerMutation.id,
      seller_transaction: sellerTxId,
      buyer_personal_transaction: buyerResult.personalTxId,
      buyer_company_funding_transaction: buyerResult.companyCashInTxId,
      buyer_company_transaction: buyerResult.companySubTxId,
    }),
  })
  if (!patchRes.ok) {
    console.warn(`[share-transfer] failed to flip share_transfer to executed: ${await patchRes.text()}`)
  } else {
    console.log(`[share-transfer] ✓ share_transfer id=${shareTransferId} → executed`)
  }

  console.log(`[share-transfer] ✓ done — sellerMut=${sellerMutation.id} buyerMut=${buyerMutation.id} shareTransferId=${shareTransferId}`)

  return NextResponse.json({
    success: true,
    shareTransferId,
    sellerMutationId: sellerMutation.id,
    buyerMutationId: buyerMutation.id,
    sellerTxId,
    sellerStakeEntityUUID: sellerStake?.entity ?? null,
    sellerStakeAssetId: sellerStake?.id ?? null,
    buyerStakeEntityUUID: buyerResult.stakeEntityUUID,
    buyerStakeAssetId: buyerResult.stakeAssetId,
    buyerPersonalTxId: buyerResult.personalTxId,
    buyerCompanyCashInTxId: buyerResult.companyCashInTxId,
    buyerCompanySubTxId: buyerResult.companySubTxId,
  })
}
