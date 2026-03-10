import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const res = await fetch(`${process.env.PLATFORM_API_URL}/investor_lead/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: res.status })
  return NextResponse.json(await res.json())
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })

  const res = await fetch(`${process.env.PLATFORM_API_URL}/investor_lead/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    return NextResponse.json({ error: err.message ?? "Update failed." }, { status: res.status })
  }
  return NextResponse.json(await res.json())
}
