import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Xano handles the cascading delete: looks up all transaction_entry records
  // for this transaction, deletes them, then deletes the transaction itself.
  const res = await fetch(`${process.env.PLATFORM_API_URL}/transaction/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to delete transaction", detail: await res.text() },
      { status: res.status }
    )
  }

  return new NextResponse(null, { status: 204 })
}
