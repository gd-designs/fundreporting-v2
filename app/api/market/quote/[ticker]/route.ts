import { type NextRequest, NextResponse } from "next/server"

const EODHD_BASE = "https://eodhd.com/api"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const token = process.env.EODHD_API_TOKEN
  if (!token) return NextResponse.json({ price: null, asOf: null })

  const { ticker } = await params

  const res = await fetch(
    `${EODHD_BASE}/real-time/${encodeURIComponent(ticker)}?api_token=${token}&fmt=json`,
    { cache: "no-store" },
  )
  if (!res.ok) return NextResponse.json({ price: null, asOf: null })

  const data = await res.json() as { close?: number; timestamp?: number }
  return NextResponse.json({
    price: typeof data.close === "number" ? data.close : null,
    asOf: typeof data.timestamp === "number" ? data.timestamp * 1000 : null,
    source: "realtime",
  })
}
