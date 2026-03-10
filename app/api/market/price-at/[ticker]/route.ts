import { type NextRequest, NextResponse } from "next/server"

const EODHD_BASE = "https://eodhd.com/api"

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const token = process.env.EODHD_API_TOKEN
  if (!token) return NextResponse.json({ price: null, source: "eod" })

  const { ticker } = await params
  const atMs = parseInt(req.nextUrl.searchParams.get("at") ?? "0")
  if (!atMs) return NextResponse.json({ price: null, source: "eod" })

  const date = new Date(atMs)
  // Use local date components to avoid UTC offset shifting the date
  const toY = date.getFullYear()
  const toM = String(date.getMonth() + 1).padStart(2, "0")
  const toD = String(date.getDate()).padStart(2, "0")
  const toStr = `${toY}-${toM}-${toD}`

  // Look back up to 10 days to handle weekends and holidays
  const fromDate = new Date(date)
  fromDate.setDate(fromDate.getDate() - 10)
  const fromY = fromDate.getFullYear()
  const fromM = String(fromDate.getMonth() + 1).padStart(2, "0")
  const fromD = String(fromDate.getDate()).padStart(2, "0")
  const fromStr = `${fromY}-${fromM}-${fromD}`

  const res = await fetch(
    `${EODHD_BASE}/eod/${encodeURIComponent(ticker)}?api_token=${token}&from=${fromStr}&to=${toStr}&fmt=json`,
    { cache: "no-store" },
  )
  if (!res.ok) return NextResponse.json({ price: null, source: "eod" })

  const data = await res.json() as Array<{ close?: number }>
  // Take the most recent point (last entry — closest to the selected date)
  const point = data[data.length - 1]

  return NextResponse.json({
    price: point && typeof point.close === "number" ? point.close : null,
    source: "eod",
  })
}
