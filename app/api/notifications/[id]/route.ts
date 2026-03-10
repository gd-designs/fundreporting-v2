import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  // Auto-stamp read_at when marking as read
  const payload = body.read === false || body.dismissed
    ? body
    : { read: true, read_at: Date.now(), ...body }

  const res = await fetch(`${process.env.PLATFORM_API_URL}/notification/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
