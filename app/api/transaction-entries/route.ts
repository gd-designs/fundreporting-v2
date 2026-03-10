import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const entity = req.nextUrl.searchParams.get("entity")
  const transaction = req.nextUrl.searchParams.get("transaction")
  const source = req.nextUrl.searchParams.get("source")
  const sourceId = req.nextUrl.searchParams.get("source_id")
  const objectId = req.nextUrl.searchParams.get("object_id")

  const url = new URL(`${process.env.PLATFORM_API_URL}/transaction_entry`)
  if (entity) url.searchParams.set("entity", entity)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })

  const all = await res.json() as Array<Record<string, unknown>>

  if (transaction) {
    // backward compat: return plain array filtered by transaction
    return NextResponse.json(all.filter((e) => e.transaction === transaction))
  }

  const filtered = all.filter((e) => {
    if (source && e.source !== source) return false
    if (sourceId && e.source_id !== sourceId) return false
    if (objectId && e.object_id !== objectId) return false
    return true
  })
  return NextResponse.json({ entries: filtered })
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const payload: Record<string, unknown> = { ...body }
  if (payload.amount !== undefined && payload.amount !== "") payload.amount = parseFloat(payload.amount as string)
  if (payload.units !== undefined && payload.units !== "") payload.units = parseFloat(payload.units as string)
  if (payload.price_per_unit !== undefined && payload.price_per_unit !== "") payload.price_per_unit = parseFloat(payload.price_per_unit as string)
  if (payload.cost !== undefined && payload.cost !== "") payload.cost = parseFloat(payload.cost as string)
  if (payload.proceeds !== undefined && payload.proceeds !== "") payload.proceeds = parseFloat(payload.proceeds as string)

  const res = await fetch(`${process.env.PLATFORM_API_URL}/transaction_entry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
