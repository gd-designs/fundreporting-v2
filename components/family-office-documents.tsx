"use client"

import * as React from "react"
import Link from "next/link"
import {
  FileText,
  Landmark,
  LayoutGrid,
  LayoutList,
  Paperclip,
  Search,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  type EntityDocument,
  formatFileSize,
  fetchDocuments,
} from "@/lib/documents"
import type { UnifiedEntity } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FoPortfolioLink = {
  id: string
  family_office: string
  portfolio: string
  label: string | null
}

type PortfolioSlice = {
  linkId: string
  portfolioId: string
  portfolioEntityId: string
  portfolioName: string
  documents: EntityDocument[]
}

const ALL_TAB = "__all__"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

// ---------------------------------------------------------------------------
// Doc row
// ---------------------------------------------------------------------------

function DocRow({
  doc,
  portfolioName,
  portfolioId,
  showPortfolio,
}: {
  doc: EntityDocument
  portfolioName: string
  portfolioId: string
  showPortfolio: boolean
}) {
  const badge = OBJECT_TYPE_BADGE[doc.objectType] ?? OBJECT_TYPE_BADGE.document
  const label = OBJECT_TYPE_LABEL[doc.objectType] ?? doc.objectType

  return (
    <div className="flex items-center gap-3 rounded-md border px-4 py-3 hover:bg-muted/20">
      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{doc.name}</p>
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge}`}>
            {label}
          </span>
        </div>
        {doc.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-muted-foreground">
            {doc.file ? formatFileSize(doc.file.size) + " · " : ""}
            {formatDate(doc.createdAt)}
          </p>
          {showPortfolio && (
            <Link
              href={`/portfolio/${portfolioId}`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {portfolioName}
            </Link>
          )}
        </div>
      </div>
      {doc.file?.url && (
        <a
          href={doc.file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Open file"
        >
          <FileText className="size-3.5" />
        </a>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Doc card
// ---------------------------------------------------------------------------

function DocCard({
  doc,
  portfolioName,
  portfolioId,
  showPortfolio,
}: {
  doc: EntityDocument
  portfolioName: string
  portfolioId: string
  showPortfolio: boolean
}) {
  const badge = OBJECT_TYPE_BADGE[doc.objectType] ?? OBJECT_TYPE_BADGE.document
  const label = OBJECT_TYPE_LABEL[doc.objectType] ?? doc.objectType

  return (
    <div className="flex flex-col gap-2 rounded-md border p-4 hover:bg-muted/20">
      <div className="flex items-start justify-between gap-2">
        <FileText className="size-5 shrink-0 text-muted-foreground mt-0.5" />
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge}`}>
          {label}
        </span>
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
      {(showPortfolio || doc.file?.url) && (
        <div className="flex items-center gap-2 pt-1 border-t">
          {showPortfolio && (
            <Link
              href={`/portfolio/${portfolioId}`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {portfolioName}
            </Link>
          )}
          {doc.file?.url && (
            <a
              href={doc.file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <FileText className="size-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FamilyOfficeDocuments({
  familyOfficeId,
  allPortfolios,
}: {
  familyOfficeId: string
  allPortfolios: UnifiedEntity[]
}) {
  const [slices, setSlices] = React.useState<PortfolioSlice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState(ALL_TAB)
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all")
  const [sort, setSort] = React.useState<"newest" | "oldest" | "name">("newest")
  const [view, setView] = React.useState<"list" | "grid">("list")

  const entityToPortfolio = React.useMemo(() => {
    const m = new Map<string, { name: string; portfolioId: string }>()
    for (const slice of slices) {
      m.set(slice.portfolioEntityId, { name: slice.portfolioName, portfolioId: slice.portfolioId })
    }
    return m
  }, [slices])

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const linksRes = await fetch(`/api/family-office-portfolios?family_office=${familyOfficeId}`)
        const links: FoPortfolioLink[] = linksRes.ok ? await linksRes.json() : []

        if (links.length === 0) {
          setSlices([])
          setLoading(false)
          return
        }

        const portfolioById = new Map(allPortfolios.map((p) => [p.id, p]))

        const loadedSlices = await Promise.all(
          links.map(async (link) => {
            const portfolio = portfolioById.get(link.portfolio)
            const entityId = portfolio?.entity ?? ""
            const name = link.label ?? portfolio?.name ?? "Unnamed"

            if (!entityId) {
              return { linkId: link.id, portfolioId: link.portfolio, portfolioEntityId: entityId, portfolioName: name, documents: [] }
            }

            const documents = await fetchDocuments(entityId).catch(() => [] as EntityDocument[])
            return { linkId: link.id, portfolioId: link.portfolio, portfolioEntityId: entityId, portfolioName: name, documents }
          })
        )

        setSlices(loadedSlices)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [familyOfficeId, allPortfolios])

  React.useEffect(() => {
    if (activeTab !== ALL_TAB && !slices.some((s) => s.linkId === activeTab)) {
      setActiveTab(ALL_TAB)
    }
  }, [slices, activeTab])

  const allDocuments = React.useMemo(() => slices.flatMap((s) => s.documents), [slices])
  const activeSlice = activeTab === ALL_TAB ? null : slices.find((s) => s.linkId === activeTab)
  const displayDocuments = activeSlice ? activeSlice.documents : allDocuments
  const showPortfolio = activeTab === ALL_TAB

  const filtered = React.useMemo(() => {
    let docs = displayDocuments
    if (search.trim()) {
      const q = search.toLowerCase()
      docs = docs.filter((d) => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q))
    }
    if (typeFilter !== "all") {
      docs = docs.filter((d) => d.objectType === typeFilter)
    }
    return [...docs].sort((a, b) => {
      if (sort === "oldest") return a.createdAt - b.createdAt
      if (sort === "name") return a.name.localeCompare(b.name)
      return b.createdAt - a.createdAt
    })
  }, [displayDocuments, search, typeFilter, sort])

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (slices.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Landmark className="size-4" /></EmptyMedia>
            <EmptyTitle>No member portfolios</EmptyTitle>
            <EmptyDescription>Link portfolios from the Members page to see aggregated documents here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-4">
      {/* Summary card */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Aggregated across all member portfolios. Read-only view.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Documents</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{displayDocuments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeSlice ? activeSlice.portfolioName : `${slices.length} portfolios`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio tiles + document list */}
      <Card>
        <CardHeader>
          <CardTitle>Document Sheets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tiles */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab(ALL_TAB)}
              className={`min-w-48 rounded-md border p-3 text-left transition-colors ${
                activeTab === ALL_TAB ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <p className="font-semibold text-sm">All Documents</p>
              <p className="mt-1 text-xl tabular-nums">{allDocuments.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {slices.length} {slices.length === 1 ? "portfolio" : "portfolios"}
              </p>
            </button>

            {slices.map((slice) => {
              const isActive = activeTab === slice.linkId
              return (
                <button
                  key={slice.linkId}
                  type="button"
                  onClick={() => setActiveTab(slice.linkId)}
                  className={`min-w-48 rounded-md border p-3 text-left transition-colors ${
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <p className="font-semibold text-sm">{slice.portfolioName}</p>
                  <p className="mt-1 text-xl tabular-nums">{slice.documents.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">documents</p>
                </button>
              )
            })}
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
          {filtered.length === 0 ? (
            <Empty className="border py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText className="size-4" /></EmptyMedia>
                <EmptyTitle>No documents</EmptyTitle>
                <EmptyDescription>
                  {search || typeFilter !== "all"
                    ? "No documents match your filters."
                    : activeSlice
                      ? `${activeSlice.portfolioName} has no documents.`
                      : "No documents across member portfolios."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : view === "list" ? (
            <div className="space-y-1.5">
              {filtered.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  portfolioName={entityToPortfolio.get(doc.entityId)?.name ?? ""}
                  portfolioId={entityToPortfolio.get(doc.entityId)?.portfolioId ?? ""}
                  showPortfolio={showPortfolio}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  portfolioName={entityToPortfolio.get(doc.entityId)?.name ?? ""}
                  portfolioId={entityToPortfolio.get(doc.entityId)?.portfolioId ?? ""}
                  showPortfolio={showPortfolio}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
