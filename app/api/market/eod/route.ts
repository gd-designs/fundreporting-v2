import { type NextRequest, NextResponse } from "next/server"

const EODHD_BASE = "https://eodhd.com/api"

export async function GET(req: NextRequest) {
  const token = process.env.EODHD_API_TOKEN
  if (!token) return NextResponse.json({ points: [] })

  const ticker = req.nextUrl.searchParams.get("ticker") ?? ""
  const fromRaw = req.nextUrl.searchParams.get("from") ?? ""
  const toRaw = req.nextUrl.searchParams.get("to")
  if (!ticker || !fromRaw) return NextResponse.json({ points: [] })

  function msToYmd(ms: number) {
    return new Date(ms).toISOString().split("T")[0]
  }
  const from = msToYmd(Number(fromRaw))
  const to = toRaw ? msToYmd(Number(toRaw)) : new Date().toISOString().split("T")[0]

  const res = await fetch(
    `${EODHD_BASE}/eod/${encodeURIComponent(ticker)}?api_token=${token}&from=${from}&to=${to}&fmt=json`,
    { cache: "no-store" },
  )
  if (!res.ok) return NextResponse.json({ points: [] })

  const data = await res.json() as Array<{ date: string; adjusted_close?: number; close?: number }>
  const points = data.map(d => ({
    date: d.date,
    close: d.adjusted_close ?? d.close ?? 0,
    timestamp: new Date(d.date).getTime(),
  }))

  return NextResponse.json({ points })
}
