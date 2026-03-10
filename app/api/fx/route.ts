import { type NextRequest, NextResponse } from "next/server"

async function fetchForexClose(symbol: string, token: string): Promise<number | null> {
  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}?api_token=${encodeURIComponent(token)}&fmt=json`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  const payload = (await res.json()) as Record<string, unknown>
  const close = payload.close
  return typeof close === "number" && Number.isFinite(close) && close > 0 ? close : null
}

export async function GET(req: NextRequest) {
  const token = process.env.EODHD_API_TOKEN
  if (!token) return NextResponse.json({ message: "EODHD_API_TOKEN not configured." }, { status: 500 })

  const base = (req.nextUrl.searchParams.get("base") ?? "EUR").trim().toUpperCase()
  const fromParam = req.nextUrl.searchParams.get("from") ?? ""
  const fromCodes = Array.from(
    new Set(fromParam.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)),
  )

  const rates: Record<string, number> = { [base]: 1 }

  await Promise.all(
    fromCodes.map(async (from) => {
      if (from === base) { rates[from] = 1; return }
      const direct = await fetchForexClose(`${from}${base}.FOREX`, token)
      if (direct) { rates[from] = direct; return }
      const reverse = await fetchForexClose(`${base}${from}.FOREX`, token)
      if (reverse) rates[from] = 1 / reverse
    }),
  )

  return NextResponse.json({ base, rates, asOf: Date.now() })
}
