import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

export async function GET(request: Request) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const q = url.searchParams.get("q") ?? ""

  const xanoUrl = new URL(`${process.env.XANO_API_URL}/auth/users`)
  if (q) xanoUrl.searchParams.set("q", q)

  const r = await fetch(xanoUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    return NextResponse.json({ error: data.error ?? data.message ?? "Failed to load users" }, { status: r.status })
  }
  return NextResponse.json(data)
}
