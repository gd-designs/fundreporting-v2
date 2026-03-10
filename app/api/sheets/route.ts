import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  const entityId = req.nextUrl.searchParams.get("entity")
  const url = entityId
    ? `${process.env.PLATFORM_API_URL}/sheet?entity=${encodeURIComponent(entityId)}`
    : `${process.env.PLATFORM_API_URL}/sheet`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (res.status === 404) return NextResponse.json({ sheets: [] })
  const payload = await res.json() as unknown
  if (!res.ok) return NextResponse.json({ message: "Failed to load sheets." }, { status: 502 })
  return NextResponse.json({ sheets: Array.isArray(payload) ? payload : [] })
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  const body = await req.json() as Record<string, unknown>
  const res = await fetch(`${process.env.PLATFORM_API_URL}/sheet`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await res.json() as unknown
  if (!res.ok) return NextResponse.json({ message: "Failed to create sheet." }, { status: 502 })
  return NextResponse.json(payload)
}
