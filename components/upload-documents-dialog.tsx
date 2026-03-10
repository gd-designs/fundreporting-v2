"use client"

import * as React from "react"
import { Paperclip, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export type DocumentObjectType = "asset" | "liability" | "transaction" | "document"

export function UploadDocumentsDialog({
  children,
  entityId,
  objectType,
  objectId,
  onUploaded,
}: {
  children: React.ReactNode
  entityId: string
  objectType: DocumentObjectType
  objectId: string
  onUploaded?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [files, setFiles] = React.useState<File[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFiles([])
    setError(null)
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    setFiles((prev) => [...prev, ...Array.from(incoming)])
  }

  async function submit() {
    if (files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.set("entity", entityId)
      form.set("object_type", objectType)
      form.set("object_id", objectId)
      for (const file of files) form.append("files", file)
      const res = await fetch("/api/documents", { method: "POST", body: form })
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string }
        setError(payload.message ?? "Upload failed.")
        return
      }
      onUploaded?.()
      setOpen(false)
      reset()
    } catch {
      setError("Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            Attach files to this record. You can select multiple files at once.
          </DialogDescription>
        </DialogHeader>

        <div
          className="mt-2 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        >
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag &amp; drop files here, or click to browse
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {files.map((file, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset() }}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={files.length === 0 || uploading}>
            {uploading ? "Uploading…" : `Upload${files.length > 0 ? ` (${files.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
