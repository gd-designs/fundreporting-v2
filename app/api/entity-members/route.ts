import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const entity = req.nextUrl.searchParams.get("entity")
  const url = entity
    ? `${process.env.PLATFORM_API_URL}/entity_member?entity=${entity}`
    : `${process.env.PLATFORM_API_URL}/entity_member`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })
  return NextResponse.json(await res.json())
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const entityName: string | null = body.entityName ?? null
  delete body.entityName

  let resolvedUserId: number | null = null

  // Resolve user id from email if provided
  if (body.email) {
    const checkRes = await fetch(`${process.env.PLATFORM_API_URL}/user/check-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email }),
    })
    if (checkRes.ok) {
      const checkData: { exists: boolean; user?: { id: number } } = await checkRes.json()
      if (!checkData.exists || checkData.user?.id == null) {
        return NextResponse.json({ error: "No user found with that email address." }, { status: 404 })
      }
      body.user = checkData.user.id
      resolvedUserId = checkData.user.id
    }
    delete body.email
  } else if (typeof body.user === "number") {
    resolvedUserId = body.user
  }

  const res = await fetch(`${process.env.PLATFORM_API_URL}/entity_member`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  const member = await res.json()

  // Fire task + notification for the added user (fire-and-forget)
  if (resolvedUserId != null) {
    const base = process.env.PLATFORM_API_URL
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    const name = entityName ?? "an entity"
    const roleLabel = body.role ? ` as ${body.role}` : ""

    fetch(`${base}/task`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner: resolvedUserId,
        assigned_to: [resolvedUserId],
        object_type: "team_invite",
        object_id: member.id,
        title: `Team invitation: ${name}${roleLabel}`,
        description: `You have been added to the team of ${name}${roleLabel}. Please accept or reject this invitation.`,
        status: "todo",
        priority: "high",
        due_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((taskData) =>
        fetch(`${base}/notification`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user: resolvedUserId,
            type: "team_invite",
            resource_id: member.id,
            task: taskData?.id ?? null,
            title: `You've been added to the team of ${name}${roleLabel}.`,
            body: "Accept this invitation to confirm your membership, or reject it if you don't recognise it.",
            read: false,
          }),
        }),
      )
      .catch(() => {})
  }

  return NextResponse.json(member)
}
