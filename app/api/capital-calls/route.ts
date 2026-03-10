import { getAuthToken } from "@/lib/auth"
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
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const res = await fetch(`${process.env.PLATFORM_API_URL}/capital_call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })

  const call = await res.json() as Record<string, unknown>

  // Fire-and-forget: email + notification for the LP
  if (call.cap_table_entry) {
    notifyLp(token, call).catch(() => {})
  }

  return NextResponse.json(call)
}

async function notifyLp(token: string, call: Record<string, unknown>) {
  const base = process.env.PLATFORM_API_URL!
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // 1. Fetch cap_table_entry → shareholder UUID
  const entryRes = await fetch(`${base}/cap_table_entry/${call.cap_table_entry}`, { headers })
  if (!entryRes.ok) return
  const entry = await entryRes.json() as Record<string, unknown>
  if (!entry.shareholder) return

  // 2. Fetch shareholder → user int + email + name
  const shRes = await fetch(`${base}/cap_table_shareholder/${entry.shareholder}`, { headers })
  if (!shRes.ok) return
  const sh = await shRes.json() as Record<string, unknown>
  if (!sh.user || !sh.email) return

  // 3. Fetch entity name
  let entityName = "your fund"
  if (call.entity) {
    const entityRes = await fetch(`${base}/entity/${call.entity}`, { headers })
    if (entityRes.ok) {
      const entity = await entityRes.json() as Record<string, unknown>
      // entity name lives on sub-table; use entity id as fallback
      entityName = (entity.name as string) ?? entityName
    }
  }

  // 4. Send email
  await sendCapitalCallEmail({
    toEmail: sh.email as string,
    toName: (sh.name as string | null) ?? null,
    entityName,
    amount: (call.amount as number | null) ?? null,
    dueDate: (call.due_date as number | null) ?? null,
  })

  // 5. Stamp notified_at on the capital call
  await fetch(`${base}/capital_call/${call.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ notified_at: Date.now() }),
  })

  // 6. Create notification for the LP user
  const amount = call.amount as number | null
  const dueDate = call.due_date as number | null
  const formattedAmount = amount != null
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(amount)
    : "a capital call"
  const formattedDue = dueDate
    ? new Date(dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null

  await fetch(`${base}/notification`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user: sh.user,
      type: "capital_call",
      resource_id: call.id,
      title: `Capital call — ${entityName}`,
      body: formattedDue ? `${formattedAmount} due ${formattedDue}` : formattedAmount,
    }),
  })
}
