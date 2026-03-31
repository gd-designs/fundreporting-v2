import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const url = req.nextUrl
  const qs = new URLSearchParams()
  const entity = url.searchParams.get("entity")
  const status = url.searchParams.get("status")
  const capTableEntry = url.searchParams.get("cap_table_entry")
  if (entity) qs.set("entity", entity)
  if (status) qs.set("status", status)
  if (capTableEntry) qs.set("cap_table_entry", capTableEntry)
  const params = qs.size > 0 ? `?${qs.toString()}` : ""

  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund_payout${params}`, {
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
  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund_payout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
