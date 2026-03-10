import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const assetManager = req.nextUrl.searchParams.get("asset_manager")
  const url = assetManager
    ? `${process.env.PLATFORM_API_URL}/investor_lead?asset_manager=${encodeURIComponent(assetManager)}`
    : `${process.env.PLATFORM_API_URL}/investor_lead`

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

  const body = await req.json()

  const res = await fetch(`${process.env.PLATFORM_API_URL}/investor_lead`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    return NextResponse.json({ error: err.message ?? "Failed to create lead." }, { status: res.status })
  }
  return NextResponse.json(await res.json(), { status: 201 })
}
