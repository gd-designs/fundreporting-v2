import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json(null, { status: 401 })

  const res = await fetch(`${process.env.PLATFORM_API_URL}/cap_table_shareholder/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json(null, { status: res.status })
  return NextResponse.json(await res.json())
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // If email is being updated, re-check user link (skip for internal patches like invite_sent)
  if (body.email !== undefined) {
    if (body.email) {
      const checkRes = await fetch(`${process.env.PLATFORM_API_URL}/user/check-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: body.email }),
      })
      if (checkRes.ok) {
        const checkData: { exists: boolean; user?: { id: number } } = await checkRes.json()
        body.user = checkData.exists && checkData.user?.id != null ? checkData.user.id : null
      }
    } else {
      body.user = null
    }
  }

  const res = await fetch(`${process.env.PLATFORM_API_URL}/cap_table_shareholder/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Xano handles the cascade: deletes all capital_call records, all
  // cap_table_entry records, then the shareholder itself.
  const res = await fetch(`${process.env.PLATFORM_API_URL}/cap_table_shareholder/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status })
  }
  return new NextResponse(null, { status: 204 })
}
