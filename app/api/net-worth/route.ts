import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"
import { computeAll, type PaymentScheme } from "@/lib/amortization"

const EODHD_BASE = "https://eodhd.com/api"

async function fetchLiveQuote(ticker: string, token: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${EODHD_BASE}/real-time/${encodeURIComponent(ticker)}?api_token=${token}&fmt=json`,
      { cache: "no-store" },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { close?: number }
    return typeof data.close === "number" && data.close > 0 ? data.close : null
  } catch {
    return null
  }
}

async function fetchFxRate(from: string, to: string, token: string): Promise<number> {
  if (from === to) return 1
  try {
    const direct = await fetch(
      `${EODHD_BASE}/real-time/${encodeURIComponent(`${from}${to}.FOREX`)}?api_token=${token}&fmt=json`,
      { cache: "no-store" },
    )
    if (direct.ok) {
      const data = (await direct.json()) as { close?: number }
      if (typeof data.close === "number" && data.close > 0) return data.close
    }
    const reverse = await fetch(
      `${EODHD_BASE}/real-time/${encodeURIComponent(`${to}${from}.FOREX`)}?api_token=${token}&fmt=json`,
      { cache: "no-store" },
    )
    if (reverse.ok) {
      const data = (await reverse.json()) as { close?: number }
      if (typeof data.close === "number" && data.close > 0) return 1 / data.close
    }
  } catch {
    // fall through
  }
  return 1
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const entityUUID = searchParams.get("entityUUID")
  const baseCurrency = (searchParams.get("baseCurrency") ?? "GBP").trim().toUpperCase()
  if (!entityUUID) return NextResponse.json({ netWorth: 0 })

  const token = await getAuthToken()
  if (!token) return NextResponse.json({ netWorth: 0 })

  const eodhdToken = process.env.EODHD_API_TOKEN
  const base = process.env.PLATFORM_API_URL
  const headers = { Authorization: `Bearer ${token}` }

  const [assetsRes, entriesRes, mutationsRes, liabilitiesRes] = await Promise.all([
    fetch(`${base}/asset?entity=${entityUUID}`, { headers, cache: "no-store" }),
    fetch(`${base}/transaction_entry?entity=${entityUUID}`, { headers, cache: "no-store" }),
    fetch(`${base}/mutation?entity=${entityUUID}`, { headers, cache: "no-store" }),
    fetch(`${base}/liability?entity=${entityUUID}`, { headers, cache: "no-store" }),
  ])

  if (!assetsRes.ok || !entriesRes.ok) return NextResponse.json({ netWorth: 0 })

  const entityAssets = ((await assetsRes.json()) as Array<Record<string, unknown>>).filter(
    (a) => a.archived !== true,
  )

  const entityEntries = (await entriesRes.json()) as Array<Record<string, unknown>>

  const allMutations = mutationsRes.ok
    ? ((await mutationsRes.json()) as Array<Record<string, unknown>>)
    : []

  // Compute per-asset unit and monetary balances from transaction entries
  const unitBalances = new Map<string, number>()
  const monetaryBalances = new Map<string, number>()

  for (const e of entityEntries) {
    const assetId =
      typeof e.asset === "string" && e.asset
        ? e.asset
        : e.object_type === "asset" && typeof e.object_id === "string"
          ? e.object_id
          : null
    if (!assetId) continue
    const dir = e.direction === "in" ? 1 : -1
    const amount = typeof e.amount === "number" ? e.amount : 0
    const units = typeof e.units === "number" ? e.units : null
    if (units !== null) {
      unitBalances.set(assetId, (unitBalances.get(assetId) ?? 0) + dir * units)
    }
    monetaryBalances.set(assetId, (monetaryBalances.get(assetId) ?? 0) + dir * amount)
  }

  // Apply mutations (revaluations) to monetary balances
  for (const m of allMutations) {
    const assetId = typeof m.asset === "string" ? m.asset : null
    if (!assetId) continue
    const delta = typeof m.delta === "number" ? m.delta : 0
    monetaryBalances.set(assetId, (monetaryBalances.get(assetId) ?? 0) + delta)
  }

  // Map assets to their tickers, currencies, and equity stake links
  const tickerByAsset = new Map<string, string>()
  const currencyByAsset = new Map<string, string>()
  const stakeShareholderByAsset = new Map<string, string>() // assetId → shareholderId

  for (const asset of entityAssets) {
    const id = asset.id as string
    const instr = asset._instrument as Record<string, unknown> | undefined
    const currency = asset._currency as Record<string, unknown> | undefined
    const currCode = (typeof currency?.code === "string" ? currency.code : baseCurrency).trim().toUpperCase()
    currencyByAsset.set(id, currCode)
    const ticker = typeof instr?.ticker === "string" ? instr.ticker.trim().toUpperCase() : ""
    if (ticker) tickerByAsset.set(id, ticker)
    const shareholderId = typeof asset.cap_table_shareholder === "string" && (asset.investable === "equity_stake" || asset.investable === "non_investable")
      ? asset.cap_table_shareholder
      : null
    if (shareholderId) stakeShareholderByAsset.set(id, shareholderId)
  }

  // Fetch live quotes, FX rates, and equity stake values in parallel
  const uniqueTickers = Array.from(new Set(tickerByAsset.values()))
  const uniqueCurrencies = Array.from(new Set(currencyByAsset.values())).filter((c) => c !== baseCurrency)
  const uniqueStakeShareholders = Array.from(new Set(stakeShareholderByAsset.values()))

  const [quotesEntries, fxEntries, stakeEntries] = await Promise.all([
    eodhdToken && uniqueTickers.length > 0
      ? Promise.all(
          uniqueTickers.map(async (ticker) => {
            const price = await fetchLiveQuote(ticker, eodhdToken)
            return [ticker, price] as [string, number | null]
          }),
        )
      : Promise.resolve([] as [string, number | null][]),
    eodhdToken && uniqueCurrencies.length > 0
      ? Promise.all(
          uniqueCurrencies.map(async (curr) => {
            const rate = await fetchFxRate(curr, baseCurrency, eodhdToken)
            return [curr, rate] as [string, number]
          }),
        )
      : Promise.resolve([] as [string, number][]),
    uniqueStakeShareholders.length > 0
      ? Promise.all(
          uniqueStakeShareholders.map(async (shId) => {
            try {
              const params = new URLSearchParams({ shareholder: shId, baseCurrency })
              const origin = new URL(request.url).origin
              const res = await fetch(`${origin}/api/cap-table-stake-value?${params}`, {
                headers: { Cookie: request.headers.get("cookie") ?? "" },
                cache: "no-store",
              })
              if (!res.ok) return [shId, null] as [string, number | null]
              const data = (await res.json()) as { value?: number | null }
              return [shId, typeof data.value === "number" ? data.value : null] as [string, number | null]
            } catch {
              return [shId, null] as [string, number | null]
            }
          }),
        )
      : Promise.resolve([] as [string, number | null][]),
  ])

  const quotes = new Map<string, number>()
  for (const [ticker, price] of quotesEntries) {
    if (price !== null) quotes.set(ticker, price)
  }

  const fxRates = new Map<string, number>([[baseCurrency, 1]])
  for (const [curr, rate] of fxEntries) {
    fxRates.set(curr, rate)
  }

  // Stake values are already in baseCurrency (the stake-value API applies baseCurrency)
  const stakeValueByShareholder = new Map<string, number>()
  for (const [shId, value] of stakeEntries) {
    if (value !== null) stakeValueByShareholder.set(shId, value)
  }

  // Compute total assets
  let assetsTotal = 0
  for (const asset of entityAssets) {
    const id = asset.id as string
    const currCode = currencyByAsset.get(id) ?? baseCurrency
    const fxRate = fxRates.get(currCode) ?? 1
    const shareholderId = stakeShareholderByAsset.get(id)
    if (shareholderId && stakeValueByShareholder.has(shareholderId)) {
      // Equity stake: value already in baseCurrency
      assetsTotal += stakeValueByShareholder.get(shareholderId)!
    } else {
      const ticker = tickerByAsset.get(id)
      if (ticker && quotes.has(ticker)) {
        const units = unitBalances.get(id) ?? 0
        if (units > 0) assetsTotal += units * quotes.get(ticker)! * fxRate
      } else {
        const balance = monetaryBalances.get(id) ?? 0
        assetsTotal += balance * fxRate
      }
    }
  }

  // Compute liabilities total
  let debtTotal = 0
  if (liabilitiesRes.ok) {
    const entityLiabilities = (await liabilitiesRes.json()) as Array<Record<string, unknown>>

    const paidMap = new Map<string, number>()
    for (const e of entityEntries) {
      if (
        e.object_type === "liability" &&
        typeof e.object_id === "string" &&
        e.entry_type === "principal" &&
        e.direction === "out"
      ) {
        paidMap.set(e.object_id, (paidMap.get(e.object_id) ?? 0) + 1)
      }
    }

    for (const l of entityLiabilities) {
      const loanAmount = typeof l.loan_amount === "number" ? l.loan_amount : 0
      const paidCount = paidMap.get(l.id as string) ?? 0
      if (
        paidCount > 0 &&
        typeof l.interest_rate === "number" &&
        typeof l.term_length === "number" &&
        typeof l.frequency === "string" &&
        typeof l.scheme === "string"
      ) {
        const periods = computeAll(loanAmount, l.interest_rate, l.frequency, l.term_length)[
          l.scheme as PaymentScheme
        ]
        debtTotal += periods[Math.min(paidCount, l.term_length) - 1]?.closing ?? loanAmount
      } else {
        debtTotal += loanAmount
      }
    }
  }

  return NextResponse.json({ netWorth: assetsTotal - debtTotal })
}
