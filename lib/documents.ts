"use client"

export type DocumentFile = {
  url: string
  name: string
  size: number
  mime: string
}

export type EntityDocument = {
  id: string
  createdAt: number
  name: string
  description: string | null
  entityId: string
  objectType: string
  objectId: string
  file: DocumentFile | null
  capShareholderName: string | null
  readOnly?: boolean
}

function mapDocument(raw: unknown): EntityDocument | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== "string") return null
  const file = (item.file_private ?? item.file) as Record<string, unknown> | null | undefined
  const cap = item._cap as Record<string, unknown> | null | undefined
  return {
    id: item.id,
    createdAt: typeof item.created_at === "number" ? item.created_at : 0,
    name: typeof item.name === "string" ? item.name : "",
    description: typeof item.description === "string" ? item.description : null,
    entityId: typeof item.entity === "string" ? item.entity : "",
    objectType: typeof item.object_type === "string" ? item.object_type : "",
    objectId: typeof item.object_id === "string" ? item.object_id : "",
    file: file
      ? {
          url: typeof file.url === "string" ? file.url : "",
          name: typeof file.name === "string" ? file.name : "",
          size: typeof file.size === "number" ? file.size : 0,
          mime: typeof file.mime === "string" ? file.mime : "",
        }
      : null,
    capShareholderName: cap && typeof cap.name === "string" ? cap.name : null,
  }
}

export async function fetchDocuments(entityId: string): Promise<EntityDocument[]> {
  const res = await fetch(`/api/documents?entity=${encodeURIComponent(entityId)}`, { cache: "no-store" })
  const payload = (await res.json()) as { documents?: unknown; message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to load documents.")
  const raw = Array.isArray(payload.documents) ? payload.documents : []
  return raw.map(mapDocument).filter((d): d is EntityDocument => d !== null)
}

export async function fetchDocumentsByShareholder(shareholderId: string): Promise<EntityDocument[]> {
  const res = await fetch(`/api/documents/by-shareholder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shareholder_id: shareholderId }),
    cache: "no-store",
  })
  if (!res.ok) return []
  const payload = (await res.json()) as { documents?: unknown }
  const raw = Array.isArray(payload.documents) ? payload.documents : []
  return raw
    .map(mapDocument)
    .filter((d): d is EntityDocument => d !== null)
    .map((d) => ({ ...d, readOnly: true }))
}

export async function patchDocument(id: string, input: { name?: string; description?: string | null; object_type?: string | null; object_id?: string | null }): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  })
  if (!res.ok) {
    const payload = (await res.json()) as { message?: string }
    throw new Error(payload.message ?? "Failed to update document.")
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
