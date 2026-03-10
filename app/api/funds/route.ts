import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken, getCurrentUser } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const managedBy = req.nextUrl.searchParams.get("managed_by")
  const url = managedBy
    ? `${process.env.PLATFORM_API_URL}/fund?managed_by=${encodeURIComponent(managedBy)}`
    : `${process.env.PLATFORM_API_URL}/fund`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })
  return NextResponse.json(await res.json())
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as {
    name: string
    fund_type?: string
    currency?: string | number
    country?: string | number
    inception_date?: number
    aum?: string | number
    managed_by?: string
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
  const base = process.env.PLATFORM_API_URL

  // Step 1: create base entity record
  const entityRes = await fetch(`${base}/entity`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "fund", owner: user.id }),
  })
  if (!entityRes.ok) {
    const err = (await entityRes.json()) as { message?: string }
    return NextResponse.json({ error: err.message ?? "Failed to create entity" }, { status: entityRes.status })
  }
  const entity = (await entityRes.json()) as { id: string }

  // Step 2: create fund record
  const fundBody: Record<string, unknown> = { entity: entity.id, name: body.name }
  if (body.fund_type) fundBody.fund_type = body.fund_type
  if (body.currency) fundBody.currency = Number(body.currency)
  if (body.country) fundBody.country = Number(body.country)
  if (body.inception_date) fundBody.inception_date = body.inception_date
  if (body.aum) fundBody.aum = Number(body.aum)
  if (body.managed_by) fundBody.managed_by = body.managed_by

  const fundRes = await fetch(`${base}/fund`, {
    method: "POST",
    headers,
    body: JSON.stringify(fundBody),
  })
  if (!fundRes.ok) {
    const err = (await fundRes.json()) as { message?: string }
    return NextResponse.json({ error: err.message ?? "Failed to create fund" }, { status: fundRes.status })
  }

  return NextResponse.json(await fundRes.json(), { status: 201 })
}
