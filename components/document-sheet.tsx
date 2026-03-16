"use client"

import * as React from "react"
import { Download, Trash2, FileText, Pencil, Loader2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatFileSize } from "@/lib/documents"

type RawDocument = {
  id: string
  name?: string | null
  description?: string | null
  created_at?: number | null
  entity?: string | null
  object_type?: string | null
  object_id?: string | null
  file?: {
    url?: string
    name?: string
    size?: number
    mime?: string
  } | null
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms))
}

function mimeLabel(mime?: string | null): string {
  if (!mime) return "File"
  if (mime.startsWith("image/")) return "Image"
  if (mime === "application/pdf") return "PDF"
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.endsWith(".xlsx")) return "Spreadsheet"
  if (mime.includes("word") || mime.endsWith(".docx")) return "Word doc"
  if (mime.startsWith("text/")) return "Text"
  return "File"
}

export function DocumentSheet({
  documentId,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  documentId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdated?: () => void
  onDeleted?: (id: string) => void
}) {
  const [doc, setDoc] = React.useState<RawDocument | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editName, setEditName] = React.useState("")
  const [editDesc, setEditDesc] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && documentId) {
      setLoading(true)
      setError(null)
      setEditing(false)
      fetch(`/api/documents/${documentId}`, { cache: "no-store" })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then((data: RawDocument) => setDoc(data))
        .catch(() => setError("Failed to load document."))
        .finally(() => setLoading(false))
    }
    if (!open) {
      setDoc(null)
      setEditing(false)
    }
  }, [open, documentId])

  function startEdit() {
    if (!doc) return
    setEditName(doc.name ?? "")
    setEditDesc(doc.description ?? "")
    setEditing(true)
    setError(null)
  }

  async function handleSave() {
    if (!doc) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() || null, description: editDesc.trim() || null }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const updated: RawDocument = await res.json()
      setDoc(updated)
      setEditing(false)
      onUpdated?.()
    } catch {
      setError("Failed to save document.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!doc || !window.confirm("Delete this document?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      onDeleted?.(doc.id)
      onOpenChange(false)
    } catch {
      setError("Failed to delete document.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw]! overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <SheetTitle className="text-base leading-snug">
              {loading ? "Loading…" : (doc?.name ?? "Untitled document")}
            </SheetTitle>
          </div>
          <SheetDescription>
            {doc ? `Uploaded ${formatDate(doc.created_at)}` : " "}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5 flex-1">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!loading && doc && (
            <>
              {/* File card */}
              {doc.file?.url && (
                <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileText className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.file.name ?? doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {mimeLabel(doc.file.mime)}
                        {doc.file.size ? ` · ${formatFileSize(doc.file.size)}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={doc.file.url} target="_blank" rel="noopener noreferrer">
                      <Download className="size-3.5" />
                      Download
                    </a>
                  </Button>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Uploaded</p>
                  <p className="font-medium">{formatDate(doc.created_at)}</p>
                </div>
                {doc.object_type && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Linked to</p>
                    <p className="font-medium capitalize">{doc.object_type.replace(/_/g, " ")}</p>
                  </div>
                )}
              </div>

              {/* Description (read or edit) */}
              {editing ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-name">Name</Label>
                    <Input
                      id="doc-name"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-desc">Description</Label>
                    <Textarea
                      id="doc-desc"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Add a description…"
                      rows={3}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving || !editName.trim()}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                doc.description && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{doc.description}</p>
                  </div>
                )
              )}

              {error && !editing && <p className="text-sm text-destructive">{error}</p>}

              {!editing && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEdit}
                  >
                    <Pencil className="size-3.5" />
                    Edit details
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
