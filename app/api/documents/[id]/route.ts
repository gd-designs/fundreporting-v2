import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await fetch(`${process.env.PLATFORM_API_URL}/document/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: res.status })
  return NextResponse.json(await res.json())
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const res = await fetch(`${process.env.PLATFORM_API_URL}/document/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const res = await fetch(`${process.env.PLATFORM_API_URL}/document/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return new NextResponse(null, { status: 204 })
}
