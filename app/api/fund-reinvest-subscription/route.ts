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
  const existingSh: { id: string; name?: string | null; user?: number | null; type?: string | null; linked_fund?: string | null } = await shRes.json()
  const name = existingSh.name ?? "Investor"
  const userId: number | null = existingSh.user ?? null
  const isCompany = existingSh.type === "company"
  const isFund = existingSh.type === "fund"

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

  // ── Step 4: Portfolio transaction chain ──────────────────────────────────────
  const grossWire = callAmount + feeAmount
  let portfolioSkipReason: string | null = null

  if (isCompany) {
    // ── Company reinvest: personal portfolio → company → fund ─────────────────
    // Chain: UBO new money IN → company equity IN → company cash IN → fund equity IN
    // Company-to-fund transaction recorded last so cash arrives before it leaves.
    console.log(`[reinvest] company investor — building 3-layer chain (userId=${userId})`)

    let companyEntityUUID: string | null = null
    let companyFundStakeAssetId: string | null = null
    let companyCashAssetId: string | null = null

    // Find which of the UBO's companies holds the fund equity stake for this entry
    if (userId != null) {
      const companiesRes = await fetch(`${base}/company/by-owner`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ owner: userId }),
      })
      if (companiesRes.ok) {
        const companies: Array<{ id: string }> = await companiesRes.json()
        for (const company of companies) {
          const assetsRes = await fetch(`${base}/asset?entity=${company.id}`, { headers: h, cache: "no-store" })
          if (!assetsRes.ok) continue
          const assets: AssetRecord[] = await assetsRes.json()
          const stake = assets.find(
            (a) => a.investable === "equity_stake" &&
              (a.cap_table_entry === entryId || a.cap_table_shareholder === fundShareholderId)
          )
          if (stake) {
            companyEntityUUID = company.id
            companyFundStakeAssetId = stake.id
            const cash = assets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
            if (cash) companyCashAssetId = cash.id
            console.log(`[reinvest] found company entity=${companyEntityUUID} fundStake=${companyFundStakeAssetId}`)
            break
          }
        }
      }
    }

    if (!companyEntityUUID) {
      portfolioSkipReason = "Could not find company entity for this investor"
      console.warn(`[reinvest] ${portfolioSkipReason}`)
    } else {
      // Create company cash asset if missing
      if (!companyCashAssetId) {
        console.log(`[reinvest] creating company cash asset`)
        const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" })
        const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
        const createCashRes = await fetch(`${base}/asset`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ entity: companyEntityUUID, asset_class: 1, name: currencyName, currency: currencyId, investable: "investable_cash", locked: true }),
        })
        if (createCashRes.ok) {
          companyCashAssetId = ((await createCashRes.json()) as { id: string }).id
          console.log(`[reinvest] created company cash asset id=${companyCashAssetId}`)
        }
      }

      // Find personal portfolio
      let personalPortfolioEntityUUID: string | null = null
      if (userId != null) {
        const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, { method: "POST", headers: h, body: JSON.stringify({ owner: userId }) })
        if (portfoliosRes.ok) {
          const portfolios: Array<{ id: string; entity: string }> = await portfoliosRes.json()
          if (portfolios.length > 0) personalPortfolioEntityUUID = portfolios[0].entity
        }
      }

      // Look up UBO's shareholder record inside the company
      let uboShareholderId: string | null = null
      if (userId != null && companyEntityUUID) {
        const lookupRes = await fetch(`${base}/cap_table_shareholder/lookup`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ entity: companyEntityUUID, user_id: userId }),
        })
        if (lookupRes.ok) {
          const uboSh: { id: string } | null = await lookupRes.json().catch(() => null)
          if (uboSh?.id) uboShareholderId = uboSh.id
        }
        console.log(`[reinvest] UBO shareholder in company id=${uboShareholderId ?? "not found"}`)
      }

      // Find personal cash + company equity stake in personal portfolio
      let personalCashAssetId: string | null = null
      let companyEquityStakeAssetId: string | null = null

      if (personalPortfolioEntityUUID) {
        const personalAssetsRes = await fetch(`${base}/asset?entity=${personalPortfolioEntityUUID}`, { headers: h, cache: "no-store" })
        if (personalAssetsRes.ok) {
          const personalAssets: AssetRecord[] = await personalAssetsRes.json()
          const cash = personalAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
          if (cash) personalCashAssetId = cash.id

          // Match company equity stake by UBO shareholder ID, or fall back to name match
          const stake =
            (uboShareholderId ? personalAssets.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === uboShareholderId) : null) ??
            personalAssets.find((a) => a.investable === "equity_stake" && a.name?.toLowerCase() === name.toLowerCase())
          if (stake) companyEquityStakeAssetId = stake.id
        }

        // Create personal cash asset if missing
        if (!personalCashAssetId) {
          console.log(`[reinvest] creating personal cash asset`)
          const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" })
          const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash"
          const createCashRes = await fetch(`${base}/asset`, {
            method: "POST",
            headers: h,
            body: JSON.stringify({ entity: personalPortfolioEntityUUID, asset_class: 1, name: currencyName, currency: currencyId, investable: "investable_cash", locked: true }),
          })
          if (createCashRes.ok) {
            personalCashAssetId = ((await createCashRes.json()) as { id: string }).id
            console.log(`[reinvest] created personal cash asset id=${personalCashAssetId}`)
          }
        }

        if (!companyEquityStakeAssetId) {
          portfolioSkipReason = "Could not find company equity stake in personal portfolio"
          console.warn(`[reinvest] ${portfolioSkipReason}`)
        }
      } else {
        portfolioSkipReason = "No personal portfolio found for UBO"
        console.warn(`[reinvest] ${portfolioSkipReason}`)
      }

      // ── Personal portfolio tx: new money IN + cash OUT + company equity IN ────
      if (personalPortfolioEntityUUID && personalCashAssetId && companyEquityStakeAssetId) {
        console.log(`[reinvest] recording personal portfolio transaction`)
        const personalTxRes = await fetch(`${base}/transaction`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ type: subscriptionTypeId, reference: `${name} — company funding`, created_by_entity: personalPortfolioEntityUUID, date: subscriptionDate }),
        })
        if (personalTxRes.ok) {
          const personalTx: { id: string } = await personalTxRes.json()
          console.log(`[reinvest] personal portfolio tx id=${personalTx.id}`)
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: personalTx.id, entity: personalPortfolioEntityUUID, entry_type: "cash", object_type: "asset", object_id: personalCashAssetId, direction: "in", currency: currencyId, amount: grossWire, source: "new_money_in" }) })
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: personalTx.id, entity: personalPortfolioEntityUUID, entry_type: "cash", object_type: "asset", object_id: personalCashAssetId, direction: "out", currency: currencyId, amount: grossWire, source: "asset", source_id: companyEquityStakeAssetId }) })
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: personalTx.id, entity: personalPortfolioEntityUUID, entry_type: "equity", object_type: "asset", object_id: companyEquityStakeAssetId, direction: "in", currency: currencyId, amount: netForShares, source: "cash", source_id: personalCashAssetId }) })
        }
      }

      // ── Company cash IN from UBO ───────────────────────────────────────────────
      if (companyEntityUUID && companyCashAssetId && uboShareholderId) {
        console.log(`[reinvest] recording company cash IN from UBO`)
        const companyCashInTxRes = await fetch(`${base}/transaction`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ type: subscriptionTypeId, reference: `UBO funding — ${name}`, created_by_entity: companyEntityUUID, date: subscriptionDate }),
        })
        if (companyCashInTxRes.ok) {
          const companyCashInTx: { id: string } = await companyCashInTxRes.json()
          console.log(`[reinvest] company cash IN tx id=${companyCashInTx.id}`)
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: companyCashInTx.id, entity: companyEntityUUID, entry_type: "cash", object_type: "asset", object_id: companyCashAssetId, direction: "in", currency: currencyId, amount: grossWire, source: "cap", source_id: uboShareholderId }) })
        }
      }

      // ── Company cash OUT → fund equity IN (last) ──────────────────────────────
      if (companyEntityUUID && companyCashAssetId && companyFundStakeAssetId) {
        console.log(`[reinvest] recording company → fund transaction`)
        const companyTxRes = await fetch(`${base}/transaction`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ type: subscriptionTypeId, reference: `${fundName ?? "Fund"} reinvestment`, created_by_entity: companyEntityUUID, date: subscriptionDate }),
        })
        if (companyTxRes.ok) {
          const companyTx: { id: string } = await companyTxRes.json()
          console.log(`[reinvest] company → fund tx id=${companyTx.id}`)
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: companyTx.id, entity: companyEntityUUID, entry_type: "cash", object_type: "asset", object_id: companyCashAssetId, direction: "out", currency: currencyId, amount: grossWire, source: "asset", source_id: companyFundStakeAssetId }) })
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: companyTx.id, entity: companyEntityUUID, entry_type: "equity", object_type: "asset", object_id: companyFundStakeAssetId, direction: "in", currency: currencyId, amount: netForShares, source: "cash", source_id: companyCashAssetId }) })
        }
      }
    }

  } else if (isFund) {
    // ── Fund reinvest: investing fund entity → receiving fund ─────────────────
    // The investing fund holds the equity stake. Cash OUT + equity IN on that entity.
    console.log(`[reinvest] fund investor — linked_fund=${existingSh.linked_fund}`)

    let investingFundEntityUUID: string | null = null
    let investingFundCashAssetId: string | null = null
    let fundEquityStakeAssetId: string | null = null

    // Resolve investing fund entity from linked_fund (fund record id → entity UUID)
    if (existingSh.linked_fund) {
      const fundRecordRes = await fetch(`${base}/fund/${existingSh.linked_fund}`, { headers: h, cache: "no-store" })
      if (fundRecordRes.ok) {
        const fundRecord = (await fundRecordRes.json()) as { entity?: string | null }
        investingFundEntityUUID = typeof fundRecord.entity === "string" ? fundRecord.entity : null
      }
    }

    if (investingFundEntityUUID) {
      const invAssetsRes = await fetch(`${base}/asset?entity=${investingFundEntityUUID}`, { headers: h, cache: "no-store" })
      if (invAssetsRes.ok) {
        const invAssets: AssetRecord[] = await invAssetsRes.json()
        const cash = invAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
        if (cash) investingFundCashAssetId = cash.id
        const stake =
          invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_entry === entryId) ??
          invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === fundShareholderId)
        if (stake) fundEquityStakeAssetId = stake.id
      }
      console.log(`[reinvest] investing fund entity=${investingFundEntityUUID} cash=${investingFundCashAssetId} stake=${fundEquityStakeAssetId}`)

      if (investingFundCashAssetId && fundEquityStakeAssetId) {
        // Investing fund tx: cash OUT + equity IN
        const txRes = await fetch(`${base}/transaction`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ type: subscriptionTypeId, reference: `${fundName ?? "Fund"} reinvestment`, created_by_entity: investingFundEntityUUID, date: subscriptionDate }),
        })
        if (txRes.ok) {
          const tx: { id: string } = await txRes.json()
          console.log(`[reinvest] investing fund tx id=${tx.id}`)
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: tx.id, entity: investingFundEntityUUID, entry_type: "cash", object_type: "asset", object_id: investingFundCashAssetId, direction: "out", currency: currencyId, amount: grossWire, source: "asset", source_id: fundEquityStakeAssetId }) })
          await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: tx.id, entity: investingFundEntityUUID, entry_type: "equity", object_type: "asset", object_id: fundEquityStakeAssetId, direction: "in", currency: currencyId, amount: netForShares, source: "cash", source_id: investingFundCashAssetId }) })
        }
      } else {
        portfolioSkipReason = !investingFundCashAssetId ? "No cash asset on investing fund" : "No equity stake asset found on investing fund"
        console.warn(`[reinvest] fund skip: ${portfolioSkipReason}`)
      }
    } else {
      portfolioSkipReason = "Could not resolve investing fund entity"
      console.warn(`[reinvest] fund skip: ${portfolioSkipReason}`)
    }

  } else {
    // ── Individual reinvest: personal portfolio → fund ────────────────────────
    let investorPortfolioEntityUUID: string | null = null
    let investorCashAssetId: string | null = null
    let fundInvestmentAssetId: string | null = null

    if (userId != null) {
      const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, { method: "POST", headers: h, body: JSON.stringify({ owner: userId }) })
      if (portfoliosRes.ok) {
        const portfolios: Array<{ id: string; entity: string }> = await portfoliosRes.json()
        if (portfolios.length > 0) investorPortfolioEntityUUID = portfolios[0].entity
      }
      if (!investorPortfolioEntityUUID) portfolioSkipReason = "No portfolio found for investor user"
    } else {
      portfolioSkipReason = "Shareholder has no linked user account"
    }

    if (investorPortfolioEntityUUID) {
      const invAssetsRes = await fetch(`${base}/asset?entity=${investorPortfolioEntityUUID}`, { headers: h, cache: "no-store" })
      if (invAssetsRes.ok) {
        const invAssets: AssetRecord[] = await invAssetsRes.json()
        const cashAsset = invAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId)
        if (cashAsset) investorCashAssetId = cashAsset.id
        const fundInvAsset =
          invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_entry === entryId) ??
          invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === fundShareholderId)
        if (fundInvAsset) fundInvestmentAssetId = fundInvAsset.id
      }
      if (!fundInvestmentAssetId) portfolioSkipReason = "Could not find equity stake asset in investor portfolio"
    }

    if (investorPortfolioEntityUUID && investorCashAssetId && fundInvestmentAssetId) {
      const invTxRes = await fetch(`${base}/transaction`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ type: subscriptionTypeId, reference: `${fundName ?? "Fund"} reinvestment`, created_by_entity: investorPortfolioEntityUUID, date: subscriptionDate }),
      })
      if (invTxRes.ok) {
        const invTx: { id: string } = await invTxRes.json()
        await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: invTx.id, entity: investorPortfolioEntityUUID, entry_type: "cash", object_type: "asset", object_id: investorCashAssetId, direction: "in", currency: currencyId, amount: grossWire, source: "new_money_in" }) })
        await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: invTx.id, entity: investorPortfolioEntityUUID, entry_type: "cash", object_type: "asset", object_id: investorCashAssetId, direction: "out", currency: currencyId, amount: grossWire, source: "asset", source_id: fundInvestmentAssetId }) })
        await fetch(`${base}/transaction_entry`, { method: "POST", headers: h, body: JSON.stringify({ transaction: invTx.id, entity: investorPortfolioEntityUUID, entry_type: "equity", object_type: "asset", object_id: fundInvestmentAssetId, direction: "in", currency: currencyId, amount: netForShares, source: "cash", source_id: investorCashAssetId }) })
      }
    }
  }

  return NextResponse.json({
    success: true,
    callId: call.id,
    isCompany,
    isFund,
    portfolioSkipReason,
  })
}
