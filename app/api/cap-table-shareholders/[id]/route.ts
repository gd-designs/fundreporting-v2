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

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  const base = process.env.PLATFORM_API_URL

  // 1. Fetch all entries for this shareholder
  const entriesRes = await fetch(`${base}/cap_table_entry?shareholder=${id}`, {
    headers,
    cache: "no-store",
  })
  const entries: { id: string }[] = entriesRes.ok ? await entriesRes.json() : []

  if (entries.length > 0) {
    // 2. Check if any entry has capital calls — if so, block the delete
    const callCounts = await Promise.all(
      entries.map(async (entry) => {
        const callsRes = await fetch(`${base}/capital_call?cap_table_entry=${entry.id}`, {
          headers,
          cache: "no-store",
        })
        const calls: unknown[] = callsRes.ok ? await callsRes.json() : []
        return calls.length
      }),
    )
    const totalCalls = callCounts.reduce((sum, n) => sum + n, 0)
    if (totalCalls > 0) {
      return NextResponse.json(
        { error: "Cannot delete this shareholder — they have capital calls recorded against their entries. Please delete the capital calls first." },
        { status: 409 },
      )
    }

    // 3. No capital calls — delete the entries
    await Promise.all(
      entries.map((entry) =>
        fetch(`${base}/cap_table_entry/${entry.id}`, { method: "DELETE", headers }),
      ),
    )
  }

  // 4. Delete the shareholder
  const res = await fetch(`${base}/cap_table_shareholder/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return new NextResponse(null, { status: 204 })
}
