import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ documents: [] }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { shareholder_id?: string }
  if (!body.shareholder_id) {
    return NextResponse.json({ documents: [] }, { status: 400 })
  }

  const res = await fetch(`${process.env.PLATFORM_API_URL}/document/by-shareholder`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ shareholder_id: body.shareholder_id }),
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json({ documents: [] }, { status: res.status })

  const payload = (await res.json()) as unknown
  const docs = Array.isArray(payload) ? payload : []
  return NextResponse.json({ documents: docs })
}
