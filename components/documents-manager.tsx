"use client"

import * as React from "react"
import Link from "next/link"
import {
  ExternalLink,
  FileText,
  LayoutGrid,
  LayoutList,
  Paperclip,
  Pencil,
  Search,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { UploadDocumentsDialog } from "@/components/upload-documents-dialog"
import {
  fetchDocuments,
  formatFileSize,
  patchDocument,
  type EntityDocument,
} from "@/lib/documents"
import { fetchEntityAssets } from "@/lib/entity-assets"

// ─── Config ────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "asset", label: "Assets" },
  { value: "liability", label: "Liabilities" },
  { value: "transaction", label: "Transactions" },
  { value: "mutation", label: "Mutations" },
  { value: "cap", label: "Cap Table" },
  { value: "document", label: "General" },
] as const

type TypeFilter = (typeof TYPE_FILTERS)[number]["value"]

const OBJECT_TYPE_LABEL: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  transaction: "Transaction",
  mutation: "Mutation",
  cap: "Cap Table",
  document: "General",
}

const OBJECT_TYPE_BADGE: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  liability: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  transaction: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  mutation: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  cap: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  document: "bg-muted text-muted-foreground",
}

function getCapHref(basePath: string, shareholderId: string): string {
  // Fund / company / family-office → their own cap-table page.
  // Standalone asset-manager (no fund nested) → investors page committed tab.
  // Note: order matters — fund nested under asset-manager has both segments,
  // so we check /fund/, /company/, /family-office/ first.
  if (
    basePath.includes("/fund/") ||
    basePath.includes("/company/") ||
    basePath.includes("/family-office/")
  ) {
    return `${basePath}/cap-table?cap=${shareholderId}`
  }
  if (basePath.includes("/asset-manager/")) {
    return `${basePath}/investors?tab=committed&investor=${shareholderId}`
  }
  return `${basePath}/cap-table?cap=${shareholderId}`
}

function getObjectHref(basePath: string, objectType: string, objectId: string): string | null {
  switch (objectType) {
    case "asset": return `${basePath}/assets?asset=${objectId}`
    case "liability": return `${basePath}/liabilities`
    case "transaction": return `${basePath}/transactions`
    case "mutation": return `${basePath}/mutations`
    case "cap": return getCapHref(basePath, objectId)
    default: return null
  }
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

// ─── Edit dialog ────────────────────────────────────────────────────────────

function EditDocDialog({
  doc,
  onClose,
  onSaved,
}: {
  doc: EntityDocument | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState("")
  const [desc, setDesc] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (doc) { setName(doc.name); setDesc(doc.description ?? ""); setError(null) }
  }, [doc])

  async function handleSave() {
    if (!doc) return
    setSaving(true)
    setError(null)
    try {
      await patchDocument(doc.id, { name: name.trim(), description: desc.trim() || null })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!doc} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
        </DialogHeader>
        <FieldGroup className="py-2">
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
          </Field>
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !name.trim()} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Row (list view) ─────────────────────────────────────────────────────────

function DocRow({
  doc,
  basePath,
  objectNames,
  onEdit,
}: {
  doc: EntityDocument
  basePath: string
  objectNames: Map<string, string>
  onEdit: (doc: EntityDocument) => void
}) {
  const href = getObjectHref(basePath, doc.objectType, doc.objectId)
  const badge = OBJECT_TYPE_BADGE[doc.objectType] ?? OBJECT_TYPE_BADGE.document
  const label = OBJECT_TYPE_LABEL[doc.objectType] ?? doc.objectType
  const objectName = objectNames.get(doc.objectId)

  return (
    <div className="flex items-center gap-3 rounded-md border px-4 py-3 hover:bg-muted/20">
      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{doc.name}</p>
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge}`}>
            {doc.objectType === "cap" ? label : (objectName ? `${label} · ${objectName}` : label)}
          </span>
          {doc.objectType === "cap" && objectName && (
            <Link
              href={getCapHref(basePath, doc.objectId)}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            >
              {objectName}
            </Link>
          )}
        </div>
        {doc.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.file ? formatFileSize(doc.file.size) + " · " : ""}
          {formatDate(doc.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {href && (
          <Link href={href} className="text-muted-foreground hover:text-foreground" title={`Go to ${label}`}>
            <ExternalLink className="size-3.5" />
          </Link>
        )}
        <button onClick={() => onEdit(doc)} className="text-muted-foreground hover:text-foreground">
          <Pencil className="size-3.5" />
        </button>
        {doc.file?.url && (
          <a
            href={doc.file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title="Open file"
          >
            <FileText className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Card (grid view) ────────────────────────────────────────────────────────

function DocCard({
  doc,
  basePath,
  objectNames,
  onEdit,
}: {
  doc: EntityDocument
  basePath: string
  objectNames: Map<string, string>
  onEdit: (doc: EntityDocument) => void
}) {
  const href = getObjectHref(basePath, doc.objectType, doc.objectId)
  const badge = OBJECT_TYPE_BADGE[doc.objectType] ?? OBJECT_TYPE_BADGE.document
  const label = OBJECT_TYPE_LABEL[doc.objectType] ?? doc.objectType
  const objectName = objectNames.get(doc.objectId)

  return (
    <div className="flex flex-col gap-2 rounded-md border p-4 hover:bg-muted/20">
      <div className="flex items-start justify-between gap-2">
        <FileText className="size-5 shrink-0 text-muted-foreground mt-0.5" />
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge}`}>
            {doc.objectType === "cap" ? label : (objectName ? `${label} · ${objectName}` : label)}
          </span>
          {doc.objectType === "cap" && objectName && (
            <Link
              href={getCapHref(basePath, doc.objectId)}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            >
              {objectName}
            </Link>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium line-clamp-2">{doc.name}</p>
        {doc.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{doc.description}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {doc.file ? formatFileSize(doc.file.size) + " · " : ""}
        {formatDate(doc.createdAt)}
      </p>
      <div className="flex items-center gap-2 pt-1 border-t">
        {href && (
          <Link href={href} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ExternalLink className="size-3" /> View {label}
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => onEdit(doc)} className="text-muted-foreground hover:text-foreground">
            <Pencil className="size-3.5" />
          </button>
          {doc.file?.url && (
            <a
              href={doc.file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <FileText className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function DocSection({
  title,
  docs,
  basePath,
  objectNames,
  view,
  onEdit,
}: {
  title?: string
  docs: EntityDocument[]
  basePath: string
  objectNames: Map<string, string>
  view: "list" | "grid"
  onEdit: (doc: EntityDocument) => void
}) {
  if (docs.length === 0) return null
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>}
      {view === "list" ? (
        <div className="space-y-1.5">
          {docs.map((doc) => <DocRow key={doc.id} doc={doc} basePath={basePath} objectNames={objectNames} onEdit={onEdit} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.map((doc) => <DocCard key={doc.id} doc={doc} basePath={basePath} objectNames={objectNames} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentsManager({
  entityUUID,
  basePath,
}: {
  entityUUID: string
  basePath: string
}) {
  const [documents, setDocuments] = React.useState<EntityDocument[]>([])
  const [objectNames, setObjectNames] = React.useState<Map<string, string>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all")
  const [sort, setSort] = React.useState<"newest" | "oldest" | "name">("newest")
  const [view, setView] = React.useState<"list" | "grid">("grid")
  const [editDoc, setEditDoc] = React.useState<EntityDocument | null>(null)
  const [page, setPage] = React.useState(0)
  const PAGE_SIZE = 100

  async function load() {
    try {
      const [docs, assets] = await Promise.all([
        fetchDocuments(entityUUID),
        fetchEntityAssets(entityUUID).catch(() => []),
      ])
      setDocuments(docs)
      const names = new Map<string, string>()
      for (const a of assets) if (a.name) names.set(a.id, a.name)
      // Cap table shareholder names come from the embedded _cap addon
      for (const d of docs) if (d.capShareholderName) names.set(d.objectId, d.capShareholderName)
      setObjectNames(names)
    } catch {
      // silently fail — empty state covers it
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { void load() }, [entityUUID]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter + sort
  const filtered = React.useMemo(() => {
    let docs = documents

    if (search.trim()) {
      const q = search.toLowerCase()
      docs = docs.filter(
        (d) => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q),
      )
    }

    if (typeFilter !== "all") {
      docs = docs.filter((d) => d.objectType === typeFilter)
    }

    return [...docs].sort((a, b) => {
      if (sort === "oldest") return a.createdAt - b.createdAt
      if (sort === "name") return a.name.localeCompare(b.name)
      return b.createdAt - a.createdAt // newest
    })
  }, [documents, search, typeFilter, sort])

  // Reset to first page whenever filters/search/sort change
  React.useEffect(() => { setPage(0) }, [search, typeFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageStart = safePage * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const pageDocs = filtered.slice(pageStart, pageEnd)

  const linked = pageDocs.filter((d) => d.objectType !== "document")
  const general = pageDocs.filter((d) => d.objectType === "document")
  const showSections = typeFilter === "all" && general.length > 0 && linked.length > 0

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Documents</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {loading ? "Loading…" : `${documents.length} document${documents.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <UploadDocumentsDialog
            entityId={entityUUID}
            objectType="document"
            objectId={entityUUID}
            onUploaded={load}
          >
            <Button size="sm">
              <Upload className="size-3.5 mr-1.5" />
              Upload
            </Button>
          </UploadDocumentsDialog>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border">
              <button
                onClick={() => setView("list")}
                className={`p-2 rounded-l-md transition-colors ${view === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
                title="List view"
              >
                <LayoutList className="size-4" />
              </button>
              <button
                onClick={() => setView("grid")}
                className={`p-2 rounded-r-md transition-colors ${view === "grid" ? "bg-muted" : "hover:bg-muted/50"}`}
                title="Grid view"
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.filter((f) => !(f.value === "cap" && basePath.includes("/portfolio/"))).map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty className="border py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>No documents</EmptyTitle>
              <EmptyDescription>
                {search || typeFilter !== "all"
                  ? "No documents match your filters."
                  : "Upload documents to attach them to this entity."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {showSections ? (
              <div className="space-y-6">
                <DocSection docs={linked} basePath={basePath} objectNames={objectNames} view={view} onEdit={setEditDoc} />
                <DocSection title="General" docs={general} basePath={basePath} objectNames={objectNames} view={view} onEdit={setEditDoc} />
              </div>
            ) : (
              <DocSection docs={pageDocs} basePath={basePath} objectNames={objectNames} view={view} onEdit={setEditDoc} />
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Page {safePage + 1} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <EditDocDialog doc={editDoc} onClose={() => setEditDoc(null)} onSaved={load} />
    </div>
  )
}
