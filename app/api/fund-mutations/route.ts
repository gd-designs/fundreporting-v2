import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const url = req.nextUrl
  const entity = url.searchParams.get("entity")
  const period = url.searchParams.get("period")
  const mutationGroup = url.searchParams.get("mutation_group")

  const qs = new URLSearchParams()
  if (entity) qs.set("entity", entity)
  if (period) qs.set("period", period)
  if (mutationGroup) qs.set("mutation_group", mutationGroup)
  const params = qs.size > 0 ? `?${qs.toString()}` : ""

  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund_mutation${params}`, {
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
  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund_mutation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
