import { type NextRequest, NextResponse } from "next/server"

const EODHD_BASE = "https://eodhd.com/api"

export async function GET(req: NextRequest) {
  const token = process.env.EODHD_API_TOKEN
  if (!token) return NextResponse.json([], { status: 500 })

  const q = req.nextUrl.searchParams.get("q") ?? ""
  const limit = req.nextUrl.searchParams.get("limit") ?? "15"
  if (!q.trim()) return NextResponse.json([])

  const res = await fetch(
    `${EODHD_BASE}/search/${encodeURIComponent(q)}?api_token=${token}&limit=${limit}`,
    { cache: "no-store" },
  )
  if (!res.ok) return NextResponse.json([])

  const data = await res.json() as Array<{
    Code: string
    Exchange: string
    Name: string
    Type: string
    Country: string
    Currency: string
    ISIN?: string
  }>

  return NextResponse.json(
    data.map(item => ({
      ticker: `${item.Code}.${item.Exchange}`,
      code: item.Code,
      exchange: item.Exchange,
      name: item.Name,
      type: item.Type,
      country: item.Country,
      currency: item.Currency,
      isin: item.ISIN ?? null,
    })),
  )
}
