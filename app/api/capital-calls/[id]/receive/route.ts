import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const base = process.env.PLATFORM_API_URL!
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // 1. Fetch full capital call (includes _entity addons)
  const callRes = await fetch(`${base}/capital_call/${id}`, { headers })
  if (!callRes.ok) return NextResponse.json({ error: "Capital call not found" }, { status: 404 })
  const call = await callRes.json() as Record<string, unknown>

  // 2. Patch received_at (and any other fields passed in body)
  const patchRes = await fetch(`${base}/capital_call/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ received_at: Date.now(), ...body }),
  })
  if (!patchRes.ok) return NextResponse.json({ error: await patchRes.text() }, { status: patchRes.status })
  const updated = await patchRes.json()

  // 3. Create settled task + notification for the entity owner (fire-and-forget)
  notifyEntityOwner(token, call).catch(() => {})

  return NextResponse.json(updated)
}

async function notifyEntityOwner(token: string, call: Record<string, unknown>) {
  const base = process.env.PLATFORM_API_URL!
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // Fetch the entity to get its owner (int user id)
  if (!call.entity) return
  const entityRes = await fetch(`${base}/entity/${call.entity}`, { headers })
  if (!entityRes.ok) return
  const entity = await entityRes.json() as Record<string, unknown>
  const ownerUserId = entity.owner as number | null
  if (!ownerUserId) return

  // Entity name from sub-table addons
  const company = entity._company as Record<string, unknown> | null
  const fund = entity._fund as Record<string, unknown> | null
  const assetMgr = entity._asset_manager as Record<string, unknown> | null
  const entityName = ((company?.name ?? fund?.name ?? assetMgr?.name) as string | undefined) ?? "your entity"

  const amount = call.amount as number | null
  const formattedAmount = amount != null
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(amount)
    : "funds"

  // Create task — owner = entity owner, assigned_to = [entity owner]
  const taskRes = await fetch(`${base}/task`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      owner: ownerUserId,
      assigned_to: [ownerUserId],
      object_type: "capital_call_settled",
      object_id: call.id,
      ...(call.entity ? { entity: call.entity } : {}),
      title: `Capital call settled — ${entityName}: ${formattedAmount}`,
      description: `Payment of ${formattedAmount} has been received for ${entityName}. Please deploy the funds.`,
      status: "todo",
      priority: "high",
    }),
  }).catch(() => null)
  const taskData = taskRes?.ok ? await taskRes.json() as Record<string, unknown> : null

  // Create notification
  await fetch(`${base}/notification`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user: ownerUserId,
      type: "capital_call",
      resource_id: call.id,
      task: taskData?.id ?? null,
      title: `Capital call settled — ${entityName}`,
      body: `${formattedAmount} received. Ready to deploy.`,
      read: false,
    }),
  }).catch(() => {})
}
