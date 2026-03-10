"use client"

export type EntitySheetType = "asset" | "liability" | "transaction" | "mutation" | "document"

export type EntitySheet = {
  id: string
  entityId: string
  type: string
  name: string
  description: string
  order: number
}

export type EntitySection = {
  id: string
  entityId: string
  sheetId: string
  name: string
  description: string
  order: number
}

export type EntitySheetItem = {
  id: string
  entityId: string
  sheetId: string
  sectionId: string | null
  objectType: string
  objectId: string
  order: number
  createdAt: number
}

function mapSheet(raw: unknown): EntitySheet | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== "string") return null
  return {
    id: item.id,
    entityId: typeof item.entity === "string" ? item.entity : "",
    type: typeof item.type === "string" ? item.type : "",
    name: typeof item.name === "string" ? item.name : "",
    description: typeof item.description === "string" ? item.description : "",
    order: typeof item.order === "number" ? item.order : 0,
  }
}

function mapSection(raw: unknown): EntitySection | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== "string") return null
  return {
    id: item.id,
    entityId: typeof item.entity === "string" ? item.entity : "",
    sheetId: typeof item.sheet === "string" ? item.sheet : "",
    name: typeof item.name === "string" ? item.name : "",
    description: typeof item.description === "string" ? item.description : "",
    order: typeof item.order === "number" ? item.order : 0,
  }
}

function mapSheetItem(raw: unknown): EntitySheetItem | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== "string") return null
  return {
    id: item.id,
    entityId: typeof item.entity === "string" ? item.entity : "",
    sheetId: typeof item.sheet === "string" ? item.sheet : "",
    sectionId: typeof item.section === "string" ? item.section : null,
    objectType: typeof item.object_type === "string" ? item.object_type : "",
    objectId: typeof item.object_id === "string" ? item.object_id : "",
    order: typeof item.order === "number" ? item.order : 0,
    createdAt: typeof item.created_at === "number" ? item.created_at : 0,
  }
}

export async function fetchEntitySheets(entityId: string, type: EntitySheetType) {
  const res = await fetch(`/api/sheets?entity=${encodeURIComponent(entityId)}`, { cache: "no-store" })
  const payload = (await res.json()) as { sheets?: unknown; message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to load sheets.")
  const raw = Array.isArray(payload.sheets) ? payload.sheets : []
  return raw
    .map(mapSheet)
    .filter((s): s is EntitySheet => !!s)
    .filter((s) => s.entityId === entityId && s.type.toLowerCase() === type.toLowerCase())
    .sort((a, b) => a.order - b.order)
}

export async function createEntitySheet(input: {
  entityId: string
  type: EntitySheetType
  name: string
  description?: string
  order: number
}) {
  const res = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: input.entityId, type: input.type, name: input.name, description: input.description ?? "", order: input.order }),
  })
  const payload = (await res.json()) as { message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to create sheet.")
}

export async function updateEntitySheet(sheetId: string, input: { name?: string; description?: string; order?: number }) {
  const body: Record<string, unknown> = {}
  if (typeof input.name === "string") body.name = input.name
  if (typeof input.description === "string") body.description = input.description
  if (typeof input.order === "number") body.order = input.order
  const res = await fetch(`/api/sheets/${encodeURIComponent(sheetId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await res.json()) as { message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to update sheet.")
}

export async function fetchEntitySections(entityId: string) {
  const res = await fetch(`/api/sections?entity=${encodeURIComponent(entityId)}`, { cache: "no-store" })
  const payload = (await res.json()) as { sections?: unknown; message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to load sections.")
  const raw = Array.isArray(payload.sections) ? payload.sections : []
  return raw
    .map(mapSection)
    .filter((s): s is EntitySection => !!s)
    .filter((s) => s.entityId === entityId)
    .sort((a, b) => a.order - b.order)
}

export async function createEntitySection(input: {
  entityId: string
  sheetId: string
  name: string
  description?: string
  order: number
}) {
  const res = await fetch("/api/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: input.entityId, sheet: input.sheetId, name: input.name, description: input.description ?? "", order: input.order }),
  })
  const payload = (await res.json()) as { message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to create section.")
}

export async function updateEntitySection(sectionId: string, input: { name?: string; description?: string; order?: number }) {
  const body: Record<string, unknown> = {}
  if (typeof input.name === "string") body.name = input.name
  if (typeof input.description === "string") body.description = input.description
  if (typeof input.order === "number") body.order = input.order
  const res = await fetch(`/api/sections/${encodeURIComponent(sectionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await res.json()) as { message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to update section.")
}

export async function fetchEntitySheetItems(entityId: string) {
  const res = await fetch(`/api/sheet-items?entity=${encodeURIComponent(entityId)}`, { cache: "no-store" })
  const payload = (await res.json()) as { items?: unknown; message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to load sheet items.")
  const raw = Array.isArray(payload.items) ? payload.items : []
  return raw
    .map(mapSheetItem)
    .filter((i): i is EntitySheetItem => !!i)
    .filter((i) => i.entityId === entityId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export async function createEntitySheetItem(input: {
  entityId: string
  sheetId: string
  sectionId?: string | null
  objectType: "asset" | "liability" | "transaction" | "mutation" | "document"
  objectId: string
  order: number
}) {
  const res = await fetch("/api/sheet-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: input.entityId, sheet: input.sheetId, section: input.sectionId ?? null, object_type: input.objectType, object_id: input.objectId, order: input.order }),
  })
  const payload = (await res.json()) as { message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to add item to sheet.")
}

export async function updateEntitySheetItem(itemId: string, input: { sectionId?: string | null; order?: number }) {
  const body: Record<string, unknown> = {}
  if (input.sectionId === null) body.section = null
  if (typeof input.sectionId === "string") body.section = input.sectionId
  if (typeof input.order === "number") body.order = input.order
  const res = await fetch(`/api/sheet-items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok && res.status !== 204) {
    const payload = (await res.json()) as { message?: string }
    throw new Error(payload.message ?? "Failed to update sheet item.")
  }
}
