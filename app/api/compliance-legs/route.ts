import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const complianceRecord = req.nextUrl.searchParams.get("compliance_record")

  const res = await fetch(`${process.env.PLATFORM_API_URL}/compliance_leg`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (res.status === 404) return NextResponse.json({ legs: [] })
  const payload = await res.json() as unknown
  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: string }).message
        : "Failed to load compliance legs."
    return NextResponse.json({ message: msg }, { status: 502 })
  }
  let legs = Array.isArray(payload) ? payload : []

  function extractId(val: unknown): string | undefined {
    if (typeof val === "string") return val
    if (val && typeof val === "object" && "id" in val) return String((val as { id: unknown }).id)
    return undefined
  }

  if (complianceRecord)
    legs = legs.filter(
      (l: { compliance_record?: unknown }) => extractId(l.compliance_record) === complianceRecord,
    )

  return NextResponse.json({ legs })
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const res = await fetch(`${process.env.PLATFORM_API_URL}/compliance_leg`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await res.json() as unknown
  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: string }).message
        : "Failed to create compliance leg."
    return NextResponse.json({ message: msg }, { status: 502 })
  }
  return NextResponse.json(payload)
}
