export const LIVE_QUOTE_UPDATED_EVENT = "live-quote-updated"

export type MarketSearchResult = {
  ticker: string    // e.g. "AAPL.US"
  code: string      // e.g. "AAPL"
  exchange: string  // e.g. "US"
  name: string
  type: string
  currency: string
  country: string
  isin: string | null
  source: "eodhd"
}

export type MarketQuote = {
  ticker: string
  price: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  asOf: number | null
  source: "eodhd"
}

export type MarketPriceAt = {
  ticker: string
  price: number | null
  asOf: number | null
  source: "intraday" | "eod"
}

export type MarketEodPoint = {
  date: string
  close: number
  timestamp: number
}

export function emitLiveQuoteUpdated(input: { ticker: string; price: number; asOf?: number | null }) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(LIVE_QUOTE_UPDATED_EVENT, {
    detail: {
      ticker: input.ticker.trim().toUpperCase(),
      price: input.price,
      asOf: input.asOf ?? Date.now(),
    },
  }))
}

export async function searchMarket(query: string, limit = 20): Promise<MarketSearchResult[]> {
  const res = await fetch(`/api/market/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  if (!res.ok) return []
  const data = await res.json() as { results?: MarketSearchResult[] } | MarketSearchResult[]
  // Support both wrapped { results: [] } and plain array responses
  return Array.isArray(data) ? data : (data.results ?? [])
}

export async function fetchMarketQuote(ticker: string): Promise<MarketQuote> {
  const res = await fetch(`/api/market/quote/${encodeURIComponent(ticker)}`)
  if (!res.ok) return { ticker, price: null, open: null, high: null, low: null, volume: null, asOf: null, source: "eodhd" }
  const data = await res.json() as Partial<MarketQuote>
  return { ticker, price: null, open: null, high: null, low: null, volume: null, asOf: null, source: "eodhd" as const, ...data }
}

export async function fetchMarketPriceAt(ticker: string, atMs: number): Promise<MarketPriceAt> {
  const res = await fetch(`/api/market/price-at/${encodeURIComponent(ticker)}?at=${atMs}`)
  if (!res.ok) return { ticker, price: null, asOf: null, source: "eod" }
  const data = await res.json() as Partial<MarketPriceAt>
  return { ticker, price: null, asOf: null, source: "eod", ...data }
}

export async function fetchMarketEodSeries(ticker: string, fromMs: number, toMs?: number): Promise<MarketEodPoint[]> {
  const params = new URLSearchParams({ ticker, from: String(fromMs) })
  if (toMs != null) params.set("to", String(toMs))
  const res = await fetch(`/api/market/eod?${params.toString()}`)
  if (!res.ok) return []
  const data = await res.json() as { points?: MarketEodPoint[] } | MarketEodPoint[]
  return Array.isArray(data) ? data : (data.points ?? [])
}
