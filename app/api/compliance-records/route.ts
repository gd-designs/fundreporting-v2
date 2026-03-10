import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const assetManager = req.nextUrl.searchParams.get("asset_manager")
  const investorLead = req.nextUrl.searchParams.get("investor_lead")

  const res = await fetch(`${process.env.PLATFORM_API_URL}/compliance_record`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (res.status === 404) return NextResponse.json({ records: [] })
  const payload = await res.json() as unknown
  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: string }).message
        : "Failed to load compliance records."
    return NextResponse.json({ message: msg }, { status: 502 })
  }
  let records = Array.isArray(payload) ? payload : []

  function extractId(val: unknown): string | undefined {
    if (typeof val === "string") return val
    if (val && typeof val === "object" && "id" in val) return String((val as { id: unknown }).id)
    return undefined
  }

  if (assetManager)
    records = records.filter(
      (r: { asset_manager?: unknown }) => extractId(r.asset_manager) === assetManager,
    )
  if (investorLead)
    records = records.filter(
      (r: { investor_lead?: unknown }) => extractId(r.investor_lead) === investorLead,
    )
  return NextResponse.json({ records })
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const res = await fetch(`${process.env.PLATFORM_API_URL}/compliance_record`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await res.json() as unknown
  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: string }).message
        : "Failed to create compliance record."
    return NextResponse.json({ message: msg }, { status: 502 })
  }
  return NextResponse.json(payload)
}
