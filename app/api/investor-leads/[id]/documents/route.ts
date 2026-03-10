import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

// POST /api/investor-leads/[id]/documents
// Forwards files to POST /document with object_type="investor_lead"
// Body: multipart/form-data with file[] and entity fields
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const incoming = await req.formData()

  const outgoing = new FormData()
  outgoing.append("object_type", "lead")
  outgoing.append("object_id", id)

  const entity = incoming.get("entity")
  if (entity) outgoing.append("entity", entity as string)

  const files = incoming.getAll("files")
  for (const f of files) outgoing.append("files", f as Blob)

  const res = await fetch(`${process.env.PLATFORM_API_URL}/document`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: outgoing,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    return NextResponse.json({ error: err.message ?? "Upload failed." }, { status: res.status })
  }
  return NextResponse.json(await res.json())
}
