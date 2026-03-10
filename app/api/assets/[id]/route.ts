import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const payload: Record<string, unknown> = { ...body }
  if (payload.currency !== undefined) payload.currency = payload.currency ? parseInt(payload.currency as string) : null
  if (payload.asset_class !== undefined) payload.asset_class = payload.asset_class ? parseInt(payload.asset_class as string) : null

  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return new NextResponse(null, { status: 204 })
}
