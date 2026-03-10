import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const entity = req.nextUrl.searchParams.get("entity")
  const asset = req.nextUrl.searchParams.get("asset")
  const source = req.nextUrl.searchParams.get("source")
  const sourceId = req.nextUrl.searchParams.get("source_id")

  const url = new URL(`${process.env.PLATFORM_API_URL}/mutation`)
  if (entity) url.searchParams.set("entity", entity)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([])

  const all = await res.json() as Array<Record<string, unknown>>
  const filtered = all.filter((m) => {
    if (asset && m.asset !== asset) return false
    if (source && m.source !== source) return false
    if (sourceId && m.source_id !== sourceId) return false
    return true
  })
  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const res = await fetch(`${process.env.PLATFORM_API_URL}/mutation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
