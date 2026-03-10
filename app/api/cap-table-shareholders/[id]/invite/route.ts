import { getAuthToken } from "@/lib/auth"
import { sendShareholderInvite } from "@/lib/email"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { entityName } = await req.json()

  // Fetch the shareholder record
  const shRes = await fetch(`${process.env.PLATFORM_API_URL}/cap_table_shareholder/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!shRes.ok) return NextResponse.json({ error: "Shareholder not found" }, { status: 404 })
  const shareholder = await shRes.json()

  if (!shareholder.email) {
    return NextResponse.json({ error: "Shareholder has no email address" }, { status: 400 })
  }

  // Check if email belongs to an existing user
  // Returns { exists: true, user: { id, ... } } or { exists: false }
  const checkRes = await fetch(`${process.env.PLATFORM_API_URL}/user/check-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: shareholder.email }),
  })
  const checkData: { exists: boolean; user?: { id: number } } = checkRes.ok
    ? await checkRes.json()
    : { exists: false }
  const isExistingUser = checkData.exists

  // Send the email
  const emailResult = await sendShareholderInvite({
    toEmail: shareholder.email,
    toName: shareholder.name ?? null,
    entityName: entityName ?? "the entity",
    isExistingUser,
  })

  if (emailResult.error) {
    return NextResponse.json({ error: emailResult.error.message }, { status: 500 })
  }

  // Stamp invited_at + invite_sent, and link the user record if they already exist
  const patch: Record<string, unknown> = { invited_at: Date.now(), invite_sent: true }
  if (isExistingUser && checkData.user?.id != null) {
    patch.user = checkData.user.id
  }
  await fetch(`${process.env.PLATFORM_API_URL}/cap_table_shareholder/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })

  return NextResponse.json({ ok: true, isExistingUser })
}
