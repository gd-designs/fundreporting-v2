import { getCurrentUser, getAuthToken } from "@/lib/auth"
import { sendShareholderInvite } from "@/lib/email"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [token, currentUser] = await Promise.all([getAuthToken(), getCurrentUser()])
  if (!token || !currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  // Stamp invited_at + invite_sent + invited_by, and link the user record if they already exist
  const patch: Record<string, unknown> = {
    invited_at: Date.now(),
    invite_sent: true,
    invited_by: currentUser.id,
  }
  if (isExistingUser && checkData.user?.id != null) {
    patch.user = checkData.user.id
  }
  await fetch(`${process.env.PLATFORM_API_URL}/cap_table_shareholder/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })

  // For existing users: create task + notification immediately
  if (isExistingUser && checkData.user?.id != null) {
    const roleLabel = shareholder.role ? ` as ${shareholder.role}` : ""
    const name = entityName ?? "an entity"
    const base = process.env.PLATFORM_API_URL
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

    // Create task (owner = inviter, assigned_to = invitee)
    const taskRes = await fetch(`${base}/task`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner: currentUser.id,
        assigned_to: [checkData.user.id],
        object_type: "cap_invite",
        object_id: id,
        title: `Cap table invitation: ${name}${roleLabel}`,
        description: `You have been invited to join the cap table of ${name}${roleLabel}. Please accept or reject this invitation.`,
        status: "todo",
        priority: "high",
        due_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }),
    }).catch(() => null)
    const taskData = taskRes?.ok ? await taskRes.json() : null

    // Create notification linked to task
    await fetch(`${base}/notification`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user: checkData.user.id,
        type: "cap_invite",
        resource_id: id,
        task: taskData?.id ?? null,
        title: `You have been invited to the cap table of ${name}${roleLabel}.`,
        body: "Accept this invitation to confirm your position, or reject it if you don't recognise it or something is wrong.",
        read: false,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, isExistingUser })
}
