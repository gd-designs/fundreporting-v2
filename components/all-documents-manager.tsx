"use client"

import * as React from "react"
import Link from "next/link"
import {
  ExternalLink,
  FileText,
  Layers,
  LayoutGrid,
  LayoutList,
  Paperclip,
  Search,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatFileSize, type EntityDocument } from "@/lib/documents"
import type { UnifiedEntity } from "@/lib/types"
import { DocumentSheet } from "@/components/document-sheet"

// ─── Config ────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "asset", label: "Assets" },
  { value: "liability", label: "Liabilities" },
  { value: "transaction", label: "Transactions" },
  { value: "mutation", label: "Mutations" },
  { value: "document", label: "General" },
] as const

type TypeFilter = (typeof TYPE_FILTERS)[number]["value"]

const OBJECT_TYPE_LABEL: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  transaction: "Transaction",
  mutation: "Mutation",
  document: "General",
}

const OBJECT_TYPE_BADGE: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  liability: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  transaction: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  mutation: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  document: "bg-muted text-muted-foreground",
}

const ENTITY_HREFS: Record<string, string> = {
  portfolio: "/portfolio",
  company: "/company",
  fund: "/fund",
  family_office: "/family-office",
  asset_manager: "/asset-manager",
}

function getObjectHref(basePath: string, objectType: string, objectId: string): string | null {
  switch (objectType) {
    case "asset": return `${basePath}/assets?asset=${objectId}`
    case "liability": return `${basePath}/liabilities`
    case "transaction": return `${basePath}/transactions`
    case "mutation": return `${basePath}/mutations`
    default: return null
  }
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function DocRow({
  doc,
  basePath,
  entityName,
  onOpen,
}: {
  doc: EntityDocument
  basePath: string | null
  entityName: string | null
  onOpen: (id: string) => void
}) {
  const href = basePath ? getObjectHref(basePath, doc.objectType, doc.objectId) : null
  const badge = OBJECT_TYPE_BADGE[doc.objectType] ?? OBJECT_TYPE_BADGE.document
  const label = OBJECT_TYPE_LABEL[doc.objectType] ?? doc.objectType

  return (
    <div
      className="flex items-center gap-3 rounded-md border px-4 py-3 hover:bg-muted/20 cursor-pointer"
      onClick={() => onOpen(doc.id)}
    >
      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{doc.name}</p>
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge}`}>
            {label}
          </span>
          {entityName && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {entityName}
            </span>
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
      {href && (
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title={`Go to ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-3.5" />
        </Link>
      )}
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

function DocCard({
  doc,
  basePath,
  entityName,
  onOpen,
}: {
  doc: EntityDocument
  basePath: string | null
  entityName: string | null
  onOpen: (id: string) => void
}) {
  const href = basePath ? getObjectHref(basePath, doc.objectType, doc.objectId) : null
  const badge = OBJECT_TYPE_BADGE[doc.objectType] ?? OBJECT_TYPE_BADGE.document
  const label = OBJECT_TYPE_LABEL[doc.objectType] ?? doc.objectType

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-4 hover:bg-muted/20 cursor-pointer"
      onClick={() => onOpen(doc.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <FileText className="size-5 shrink-0 text-muted-foreground mt-0.5" />
        <div className="flex gap-1 flex-wrap justify-end">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge}`}>
            {label}
          </span>
          {entityName && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {entityName}
            </span>
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
      {href && (
        <div className="pt-1 border-t">
          <Link
            href={href}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" /> View {label}
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Entity group ─────────────────────────────────────────────────────────────

function EntityGroup({
  entity,
  docs,
  view,
  onOpen,
}: {
  entity: UnifiedEntity
  docs: EntityDocument[]
  view: "list" | "grid"
  onOpen: (id: string) => void
}) {
  const basePath = entity ? `${ENTITY_HREFS[entity.type] ?? ""}/${entity.id}` : null
  const entityName = entity?.name ?? null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{entityName ?? "Unknown entity"}</p>
        <span className="text-xs text-muted-foreground">· {docs.length}</span>
      </div>
      {view === "list" ? (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <DocRow key={doc.id} doc={doc} basePath={basePath} entityName={null} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {docs.map((doc) => (
            <DocCard key={doc.id} doc={doc} basePath={basePath} entityName={null} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AllDocumentsManager({ entities }: { entities: UnifiedEntity[] }) {
  const [documents, setDocuments] = React.useState<EntityDocument[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all")
  const [sort, setSort] = React.useState<"newest" | "oldest" | "name">("newest")
  const [view, setView] = React.useState<"list" | "grid">("list")
  const [groupByEntity, setGroupByEntity] = React.useState(false)
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  function openDoc(id: string) {
    setSelectedDocId(id)
    setSheetOpen(true)
  }

  const entityMap = React.useMemo(
    () => new Map(entities.map((e) => [e.entity, e])),
    [entities],
  )

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/documents", { cache: "no-store" })
      const payload = await res.json() as { documents?: unknown }
      const raw = Array.isArray(payload.documents) ? payload.documents : []
      // Map raw docs
      const mapped: EntityDocument[] = raw
        .map((item: unknown) => {
          if (!item || typeof item !== "object") return null
          const d = item as Record<string, unknown>
          if (typeof d.id !== "string") return null
          const file = d.file as Record<string, unknown> | null | undefined
          return {
            id: d.id,
            createdAt: typeof d.created_at === "number" ? d.created_at : 0,
            name: typeof d.name === "string" ? d.name : "",
            description: typeof d.description === "string" ? d.description : null,
            entityId: typeof d.entity === "string" ? d.entity : "",
            objectType: typeof d.object_type === "string" ? d.object_type : "",
            objectId: typeof d.object_id === "string" ? d.object_id : "",
            file: file
              ? {
                  url: typeof file.url === "string" ? file.url : "",
                  name: typeof file.name === "string" ? file.name : "",
                  size: typeof file.size === "number" ? file.size : 0,
                  mime: typeof file.mime === "string" ? file.mime : "",
                }
              : null,
          } satisfies EntityDocument
        })
        .filter((d): d is EntityDocument => d !== null)
      setDocuments(mapped)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      return b.createdAt - a.createdAt
    })
  }, [documents, search, typeFilter, sort])

  // Group by entity (using entityId which is the entity UUID)
  const groups = React.useMemo(() => {
    if (!groupByEntity) return null
    const map = new Map<string, EntityDocument[]>()
    for (const doc of filtered) {
      const arr = map.get(doc.entityId) ?? []
      arr.push(doc)
      map.set(doc.entityId, arr)
    }
    return map
  }, [filtered, groupByEntity])

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">All Documents</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {loading ? "Loading…" : `${documents.length} document${documents.length !== 1 ? "s" : ""} across all entities`}
            </p>
          </div>
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
            <button
              onClick={() => setGroupByEntity((v) => !v)}
              title="Group by entity"
              className={`rounded-md border p-2 transition-colors ${groupByEntity ? "bg-muted" : "hover:bg-muted/50"}`}
            >
              <Layers className="size-4" />
            </button>
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
          {TYPE_FILTERS.map((f) => (
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
            {Array.from({ length: 5 }).map((_, i) => (
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
                  : "Upload documents from an entity's Documents tab."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : groupByEntity && groups ? (
          <div className="space-y-8">
            {Array.from(groups.entries()).map(([entityId, docs]) => {
              const entity = entityMap.get(entityId)
              if (!entity) return null
              return (
                <EntityGroup
                  key={entityId}
                  entity={entity}
                  docs={docs}
                  view={view}
                  onOpen={openDoc}
                  entityMap={entityMap}
                />
              )
            })}
          </div>
        ) : view === "list" ? (
          <div className="space-y-1.5">
            {filtered.map((doc) => {
              const entity = entityMap.get(doc.entityId)
              const basePath = entity ? `${ENTITY_HREFS[entity.type] ?? ""}/${entity.id}` : null
              return (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  basePath={basePath}
                  entityName={entity?.name ?? null}
                  onOpen={openDoc}
                />
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((doc) => {
              const entity = entityMap.get(doc.entityId)
              const basePath = entity ? `${ENTITY_HREFS[entity.type] ?? ""}/${entity.id}` : null
              return (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  basePath={basePath}
                  entityName={entity?.name ?? null}
                  onOpen={openDoc}
                />
              )
            })}
          </div>
        )}
      </div>

      <DocumentSheet
        documentId={selectedDocId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={load}
        onDeleted={() => { setSheetOpen(false); void load() }}
      />
    </div>
  )
}
