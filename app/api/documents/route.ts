import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const entityId = req.nextUrl.searchParams.get("entity")
  const objectType = req.nextUrl.searchParams.get("object_type")
  const objectId = req.nextUrl.searchParams.get("object_id")

  const url = entityId
    ? `${process.env.PLATFORM_API_URL}/document?entity=${encodeURIComponent(entityId)}`
    : `${process.env.PLATFORM_API_URL}/document`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (res.status === 404) return NextResponse.json({ documents: [] })
  const payload = await res.json() as unknown
  if (!res.ok) {
    const msg = payload && typeof payload === "object" && "message" in payload
      ? (payload as { message?: string }).message
      : "Failed to load documents."
    return NextResponse.json({ message: msg }, { status: 502 })
  }
  let docs = Array.isArray(payload) ? payload : []
  if (objectType) docs = docs.filter((d: { object_type?: string }) => d.object_type === objectType)
  if (objectId) docs = docs.filter((d: { object_id?: string }) => d.object_id === objectId)
  return NextResponse.json({ documents: docs })
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const incoming = await req.formData()
  const entity = incoming.get("entity")
  const objectType = incoming.get("object_type")
  const objectId = incoming.get("object_id")
  const files = incoming.getAll("files")

  if (!entity || files.length === 0) {
    return NextResponse.json({ message: "Missing required fields." }, { status: 400 })
  }

  const form = new FormData()
  form.set("entity", entity as string)
  if (objectType) form.set("object_type", objectType as string)
  if (objectId) form.set("object_id", objectId as string)
  for (const file of files) form.append("files[]", file as Blob)

  const res = await fetch(`${process.env.PLATFORM_API_URL}/document`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const payload = await res.json() as unknown
  if (!res.ok) {
    const msg = payload && typeof payload === "object" && "message" in payload
      ? (payload as { message?: string }).message
      : "Failed to upload document."
    return NextResponse.json({ message: msg }, { status: 502 })
  }
  return NextResponse.json(payload)
}
