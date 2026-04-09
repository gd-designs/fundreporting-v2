"use client"

import * as React from "react"
import { Upload, Paperclip, ExternalLink, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { formatFileSize } from "@/lib/documents"

type DocFile = { url: string; name: string; size: number; mime: string }
type Doc = {
  id: string
  name: string
  description: string | null
  file: DocFile | null
}

type UploadItem = {
  file: File
  status: "queued" | "uploading" | "done" | "error"
  error?: string
}

function mapDoc(raw: unknown): Doc | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== "string") return null
  const f = (r.file_private ?? r.file) as Record<string, unknown> | null | undefined
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : "",
    description: typeof r.description === "string" ? r.description : null,
    file: f
      ? {
          url: typeof f.url === "string" ? f.url : "",
          name: typeof f.name === "string" ? f.name : "",
          size: typeof f.size === "number" ? f.size : 0,
          mime: typeof f.mime === "string" ? f.mime : "",
        }
      : null,
  }
}

export function ShareholderDocumentsTab({
  shareholderId,
  entityUUID,
}: {
  shareholderId: string
  entityUUID: string
}) {
  const [docs, setDocs] = React.useState<Doc[]>([])
  const [loading, setLoading] = React.useState(false)
  const [uploads, setUploads] = React.useState<UploadItem[]>([])
  const [editDoc, setEditDoc] = React.useState<Doc | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editDesc, setEditDesc] = React.useState("")
  const [editSaving, setEditSaving] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/documents?entity=${encodeURIComponent(entityUUID)}&object_type=cap&object_id=${encodeURIComponent(shareholderId)}`,
        { cache: "no-store" }
      )
      const payload = (await res.json()) as { documents?: unknown[] }
      const raw = Array.isArray(payload.documents) ? payload.documents : []
      setDocs(raw.map(mapDoc).filter((d): d is Doc => d !== null))
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [shareholderId, entityUUID])

  React.useEffect(() => { void load() }, [load])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const items: UploadItem[] = Array.from(files).map((f) => ({ file: f, status: "queued" as const }))
    setUploads((prev) => [...prev, ...items])

    for (const item of items) {
      setUploads((prev) => prev.map((u) => u.file === item.file ? { ...u, status: "uploading" as const } : u))
      try {
        const form = new FormData()
        form.set("entity", entityUUID)
        form.set("object_type", "cap")
        form.set("object_id", shareholderId)
        form.append("files", item.file)
        const res = await fetch("/api/documents", { method: "POST", body: form })
        if (!res.ok) {
          const payload = (await res.json()) as { message?: string }
          throw new Error(payload.message ?? "Upload failed")
        }
        setUploads((prev) => prev.map((u) => u.file === item.file ? { ...u, status: "done" as const } : u))
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed"
        setUploads((prev) => prev.map((u) => u.file === item.file ? { ...u, status: "error" as const, error: msg } : u))
      }
    }
    void load()
    setTimeout(() => setUploads((prev) => prev.filter((u) => u.status !== "done")), 2000)
  }

  function openEdit(doc: Doc) {
    setEditDoc(doc)
    setEditName(doc.name)
    setEditDesc(doc.description ?? "")
    setEditError(null)
  }

  async function handleEditSave() {
    if (!editDoc) return
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/documents/${editDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setEditDoc(null)
      void load()
    } catch {
      setEditError("Failed to save document.")
    } finally {
      setEditSaving(false)
    }
  }

  const pending = uploads.filter((u) => u.status === "queued" || u.status === "uploading")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-3.5 mr-1.5" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Upload queue */}
      {pending.length > 0 && (
        <div className="space-y-1.5">
          {pending.map((u, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{u.file.name}</span>
              {u.status === "uploading" ? (
                <Spinner className="size-3.5" />
              ) : (
                <span className="text-xs text-muted-foreground">Queued</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-4" />
        </div>
      ) : docs.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-sm text-muted-foreground cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-5 opacity-40" />
          <p>No documents yet — click to upload</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{doc.name}</p>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                  )}
                  {doc.file && (
                    <p className="text-xs text-muted-foreground">{formatFileSize(doc.file.size)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => openEdit(doc)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
                {doc.file?.url && (
                  <a
                    href={doc.file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${doc.name}"?`)) return
                    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" })
                    void load()
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit document dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => { if (!o) setEditDoc(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          <FieldGroup className="py-2">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Optional" />
            </Field>
            {editError && <FieldError>{editError}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Cancel</Button>
            <Button disabled={editSaving || !editName.trim()} onClick={handleEditSave}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
