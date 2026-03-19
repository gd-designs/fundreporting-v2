import { getAuthToken, getCurrentUser } from "@/lib/auth"
import { sendCapitalCallEmail } from "@/lib/email"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const entity = req.nextUrl.searchParams.get("entity")
  const entryId = req.nextUrl.searchParams.get("cap_table_entry")

  const url = new URL(`${process.env.PLATFORM_API_URL}/capital_call`)
  if (entity) url.searchParams.set("entity", entity)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })

  const all = await res.json() as Array<Record<string, unknown>>
  const filtered = entryId ? all.filter((r) => r.cap_table_entry === entryId) : all
  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  // bypass=true skips all notifications, tasks, and emails — used for historical/bulk data entry
  const bypass = req.nextUrl.searchParams.get("bypass") === "true"
  const [token, currentUser] = await Promise.all([getAuthToken(), getCurrentUser()])
  if (!token || !currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const res = await fetch(`${process.env.PLATFORM_API_URL}/capital_call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })

  const call = await res.json() as Record<string, unknown>

  // Fire-and-forget: task + notification for the LP (skipped in bypass mode)
  if (!bypass && call.cap_table_entry) {
    notifyLp(token, currentUser.id, call).catch(() => {})
  }

  return NextResponse.json(call)
}

async function notifyLp(token: string, _currentUserId: number, call: Record<string, unknown>) {
  const base = process.env.PLATFORM_API_URL!
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // 1–3. Fetch the full capital call record (includes _cap_table_entry._shareholder and _entity sub-tables)
  const callRes = await fetch(`${base}/capital_call/${call.id}`, { headers })
  if (!callRes.ok) return
  const fullCall = await callRes.json() as Record<string, unknown>

  // Shareholder from nested addon
  const entry = fullCall._cap_table_entry as Record<string, unknown> | null
  if (!entry) return
  const sh = entry._shareholder as Record<string, unknown> | null
  if (!sh?.user || !sh?.email) return

  // Entity name from nested addon (all correctly filtered by entity UUID)
  const entityAddon = fullCall._entity as Record<string, unknown> | null
  const company = entityAddon?._company as Record<string, unknown> | null
  const fund = entityAddon?._fund as Record<string, unknown> | null
  const assetMgr = entityAddon?._asset_manager as Record<string, unknown> | null
  const entityName = ((company?.name ?? fund?.name ?? assetMgr?.name) as string | undefined) ?? "your fund"

  // 4. Send email (non-blocking — task + notification must still be created even if email fails)
  await sendCapitalCallEmail({
    toEmail: sh.email as string,
    toName: (sh.name as string | null) ?? null,
    entityName,
    amount: (call.amount as number | null) ?? null,
    dueDate: (call.due_date as number | null) ?? null,
  }).catch(() => {})

  // 5. Stamp notified_at on the capital call
  await fetch(`${base}/capital_call/${call.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ notified_at: Date.now() }),
  })

  // 6. Format amount / due date for task + notification
  const amount = call.amount as number | null
  const dueDate = call.due_date as number | null
  const formattedAmount = amount != null
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(amount)
    : "a capital call"
  const formattedDue = dueDate
    ? new Date(dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null

  // 7. Create task (owner = fund manager, assigned_to = LP user)
  const taskTitle = `Capital call — ${entityName}: ${formattedAmount}${formattedDue ? ` due ${formattedDue}` : ""}`
  const taskRes = await fetch(`${base}/task`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      owner: sh.user,
      assigned_to: [sh.user],
      object_type: "capital_call",
      object_id: call.id,
      ...(call.entity ? { entity: call.entity } : {}),
      title: taskTitle,
      description: `You have a capital call of ${formattedAmount} from ${entityName}${formattedDue ? `, due ${formattedDue}` : ""}. Please complete the payment from your tasks.`,
      status: "todo",
      priority: "high",
      ...(dueDate ? { due_date: dueDate } : {}),
    }),
  }).catch(() => null)
  const taskData = taskRes?.ok ? await taskRes.json() as Record<string, unknown> : null

  // 8. Create notification linked to task
  await fetch(`${base}/notification`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user: sh.user,
      type: "capital_call",
      resource_id: call.id,
      task: taskData?.id ?? null,
      title: `Capital call — ${entityName}`,
      body: formattedDue ? `${formattedAmount} due ${formattedDue}` : formattedAmount,
      read: false,
    }),
  }).catch(() => {})
}
