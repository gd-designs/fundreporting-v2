import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const base = process.env.PLATFORM_API_URL
  const headers = { Authorization: `Bearer ${token}` }

  // Fetch the fund to get its entity UUID before deleting
  const fundRes = await fetch(`${base}/fund/${id}`, { headers, cache: "no-store" })
  if (!fundRes.ok) return NextResponse.json({ error: "Fund not found" }, { status: 404 })
  const fund = await fundRes.json() as { entity?: string }

  // Delete the fund record
  const delFund = await fetch(`${base}/fund/${id}`, { method: "DELETE", headers })
  if (!delFund.ok) {
    const err = await delFund.json().catch(() => ({})) as { message?: string }
    return NextResponse.json({ error: err.message ?? "Failed to delete fund." }, { status: delFund.status })
  }

  // Delete the base entity record
  if (fund.entity) {
    await fetch(`${base}/entity/${fund.entity}`, { method: "DELETE", headers })
  }

  return NextResponse.json({ success: true })
}
