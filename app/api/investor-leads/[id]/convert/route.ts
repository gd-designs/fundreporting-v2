import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

type Interest = {
  fundEntity: string
  shareClass?: string | null
  committedAmount?: number | null
}

type ConvertBody = {
  name?: string
  email?: string
  type?: "individual" | "company"
  assetManagerEntityId: string
  interests: Interest[]
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: leadId } = await params
  const body = (await req.json()) as ConvertBody

  if (!body.assetManagerEntityId) {
    return NextResponse.json({ error: "assetManagerEntityId is required" }, { status: 400 })
  }

  const base = process.env.PLATFORM_API_URL!
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // ── Step 1: Create AM-level shareholder ───────────────────────────────────
  const amShRes = await fetch(`${base}/cap_table_shareholder`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      entity: body.assetManagerEntityId,
      name: body.name ?? undefined,
      email: body.email ?? undefined,
      type: body.type ?? "individual",
      role: "investor",
    }),
  })
  if (!amShRes.ok) {
    return NextResponse.json(
      { error: "Failed to create shareholder", detail: await amShRes.text() },
      { status: amShRes.status }
    )
  }
  const amShareholder = await amShRes.json() as { id: string }

  // ── Step 2: Create AM-level cap table entry (total commitment) ─────────────
  const totalCommitted = (body.interests ?? []).reduce(
    (sum, i) => sum + (i.committedAmount ?? 0),
    0
  )
  const amEntryRes = await fetch(`${base}/cap_table_entry`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      entity: body.assetManagerEntityId,
      shareholder: amShareholder.id,
      committed_amount: totalCommitted > 0 ? totalCommitted : undefined,
      issued_at: Date.now(),
    }),
  })
  if (!amEntryRes.ok) {
    return NextResponse.json(
      { error: "Failed to create cap table entry", detail: await amEntryRes.text(), partial: { amShareholder } },
      { status: amEntryRes.status }
    )
  }
  const amEntry = await amEntryRes.json() as { id: string }

  // ── Step 3: Create fund-level shareholder + entry per interest ────────────
  const fundRecords: Array<{
    fundEntity: string
    shareholderId: string
    entryId: string
    shareClass: string | null
    committedAmount: number | null
  }> = []
  const failures: Array<{ fundEntity: string; error: string }> = []

  for (const interest of body.interests ?? []) {
    if (!interest.fundEntity) continue

    // Fund-level shareholder (child of AM shareholder)
    const fundShRes = await fetch(`${base}/cap_table_shareholder`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        entity: interest.fundEntity,
        name: body.name ?? undefined,
        email: body.email ?? undefined,
        type: body.type ?? "individual",
        role: "investor",
        parent_shareholder: amShareholder.id,
      }),
    })
    if (!fundShRes.ok) {
      failures.push({ fundEntity: interest.fundEntity, error: await fundShRes.text() })
      continue
    }
    const fundShareholder = await fundShRes.json() as { id: string }

    // Fund-level entry
    const fundEntryRes = await fetch(`${base}/cap_table_entry`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        entity: interest.fundEntity,
        shareholder: fundShareholder.id,
        committed_amount: interest.committedAmount ?? undefined,
        issued_at: Date.now(),
      }),
    })
    if (!fundEntryRes.ok) {
      failures.push({ fundEntity: interest.fundEntity, error: await fundEntryRes.text() })
      continue
    }
    const fundEntry = await fundEntryRes.json() as { id: string }

    fundRecords.push({
      fundEntity: interest.fundEntity,
      shareholderId: fundShareholder.id,
      entryId: fundEntry.id,
      shareClass: interest.shareClass ?? null,
      committedAmount: interest.committedAmount ?? null,
    })
  }

  // ── Step 4: PATCH lead to investor status ─────────────────────────────────
  const leadRes = await fetch(`${base}/investor_lead/${leadId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      status: "investor",
      converted_at: Date.now(),
      converted_to_shareholder: amShareholder.id,
    }),
  })
  if (!leadRes.ok) {
    return NextResponse.json(
      {
        error: "Conversion succeeded but lead status update failed",
        detail: await leadRes.text(),
        partial: { amShareholder, amEntry, fundRecords, failures },
      },
      { status: 207 }
    )
  }
  const updatedLead = await leadRes.json()

  return NextResponse.json({
    amShareholder,
    amEntry,
    fundRecords,
    failures: failures.length > 0 ? failures : undefined,
    lead: updatedLead,
  })
}
