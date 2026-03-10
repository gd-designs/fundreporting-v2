import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const entity = req.nextUrl.searchParams.get("entity")

  const url = new URL(`${process.env.PLATFORM_API_URL}/asset`)
  if (entity) url.searchParams.set("entity", entity)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })

  return NextResponse.json(await res.json())
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const payload: Record<string, unknown> = { ...body }
  if (payload.currency) payload.currency = parseInt(payload.currency as string)
  if (payload.asset_class) payload.asset_class = parseInt(payload.asset_class as string)
  if (payload.asset_class === 1 && !payload.investable) payload.investable = "investable_cash"

  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
