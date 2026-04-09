"use client"

import * as React from "react"
import { Paperclip, Pencil, Plus } from "lucide-react"
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
import { patchDocument, formatFileSize, type EntityDocument } from "@/lib/documents"

export function DocumentList({
  documents,
  onUpdated,
}: {
  documents: EntityDocument[]
  onUpdated?: () => void
}) {
  const [editDoc, setEditDoc] = React.useState<EntityDocument | null>(null)
  const [editDocName, setEditDocName] = React.useState("")
  const [editDocDesc, setEditDocDesc] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function openEdit(doc: EntityDocument) {
    setEditDoc(doc)
    setEditDocName(doc.name)
    setEditDocDesc(doc.description ?? "")
    setError(null)
  }

  function closeEdit() {
    setEditDoc(null)
    setError(null)
  }

  async function handleSave() {
    if (!editDoc) return
    setSaving(true)
    setError(null)
    try {
      await patchDocument(editDoc.id, {
        name: editDocName.trim(),
        description: editDocDesc.trim() || null,
      })
      onUpdated?.()
      closeEdit()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-2">
        {documents.map((doc) => (
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
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file.size)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!doc.readOnly && (
                <button
                  onClick={() => openEdit(doc)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
              {doc.file?.url && (
                <a
                  href={doc.file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3.5 rotate-45" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editDoc} onOpenChange={(o) => { if (!o) closeEdit() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          <FieldGroup className="py-2">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={editDocName}
                onChange={(e) => setEditDocName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                value={editDocDesc}
                onChange={(e) => setEditDocDesc(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button disabled={saving || !editDocName.trim()} onClick={handleSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
