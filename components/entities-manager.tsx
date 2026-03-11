"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  Landmark,
  LayoutGrid,
  Search,
  TrendingUp,
  Users,
} from "lucide-react"
import { AddEntityDialog } from "@/components/add-entity-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import type { EntityType, UnifiedEntity } from "@/lib/types"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  EntityType,
  {
    label: string
    icon: React.ElementType
    color: string
  }
> = {
  portfolio: {
    label: "Portfolio",
    icon: Landmark,
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  company: {
    label: "Company",
    icon: Building2,
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  family_office: {
    label: "Family Office",
    icon: Users,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  asset_manager: {
    label: "Asset Manager",
    icon: BarChart3,
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  fund: {
    label: "Fund",
    icon: TrendingUp,
    color:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
}

const ENTITY_HREFS: Record<EntityType, string> = {
  portfolio: "/portfolio",
  company: "/company",
  family_office: "/family-office",
  asset_manager: "/asset-manager",
  fund: "/fund",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAUM(aum: number): string {
  if (aum >= 1_000_000_000) return `${(aum / 1_000_000_000).toFixed(1)}B`
  if (aum >= 1_000_000) return `${(aum / 1_000_000).toFixed(1)}M`
  if (aum >= 1_000) return `${(aum / 1_000).toFixed(1)}K`
  return String(aum)
}

function formatYear(date: string | undefined): string {
  if (!date) return "—"
  const year = new Date(date).getFullYear()
  return isNaN(year) ? "—" : String(year)
}

function formatCreated(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type MetaChip = { label: string; value: string }

function getMetaChips(entity: UnifiedEntity): MetaChip[] {
  switch (entity.type) {
    case "portfolio":
      return [
        { label: "Currency", value: entity._currency?.code ?? "—" },
        { label: "Since", value: formatYear(entity.inception_date) },
      ]
    case "company":
      return [
        { label: "Industry", value: entity.industry ?? "—" },
        { label: "Country", value: String(entity.country ?? "—") },
      ]
    case "family_office":
      return [{ label: "Country", value: String(entity.country ?? "—") }]
    case "asset_manager":
      return [
        {
          label: "AUM",
          value: entity.aum != null ? formatAUM(entity.aum) : "—",
        },
        { label: "Country", value: String(entity.country ?? "—") },
      ]
    case "fund":
      return [
        { label: "Type", value: entity.fund_type ?? "—" },
        { label: "AUM", value: entity.aum != null ? formatAUM(entity.aum) : "—" },
        { label: "Since", value: formatYear(entity.inception_date) },
      ]
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc"

function sortEntities(entities: UnifiedEntity[], sort: SortKey): UnifiedEntity[] {
  return [...entities].sort((a, b) => {
    switch (sort) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case "name_asc":
        return (a.name ?? "").localeCompare(b.name ?? "")
      case "name_desc":
        return (b.name ?? "").localeCompare(a.name ?? "")
    }
  })
}

// ---------------------------------------------------------------------------
// Entity card
// ---------------------------------------------------------------------------

function EntityCard({ entity }: { entity: UnifiedEntity }) {
  const config = TYPE_CONFIG[entity.type]
  const Icon = config.icon
  const href = `${ENTITY_HREFS[entity.type]}/${entity.id}`
  const chips = getMetaChips(entity)

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border bg-card p-5 transition-all",
        "hover:border-ring/50 hover:shadow-md"
      )}
    >
      {/* Top row: icon + type label + arrow */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex shrink-0 items-center justify-center rounded-lg p-2", config.color)}>
            <Icon className="size-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {config.label}
          </span>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      </div>

      {/* Name */}
      <div className="flex-1">
        <p className="text-lg font-semibold leading-tight tracking-tight">
          {entity.name ?? <span className="text-muted-foreground">Unnamed</span>}
        </p>
      </div>

      {/* Bottom row: chips + date */}
      <div className="flex items-end justify-between gap-2">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] leading-none"
              >
                <span className="text-muted-foreground">{chip.label}</span>
                <span className="font-medium">{chip.value}</span>
              </span>
            ))}
          </div>
        )}
        <span className="shrink-0 text-[11px] text-muted-foreground/70">
          {formatCreated(entity.created_at)}
        </span>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EntitiesManager({ entities }: { entities: UnifiedEntity[] }) {
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<EntityType | "all">("all")
  const [sort, setSort] = React.useState<SortKey>("newest")

  // Build per-type counts (only for types present in data)
  const typeCounts = React.useMemo(() => {
    const counts: Partial<Record<EntityType, number>> = {}
    for (const e of entities) {
      counts[e.type] = (counts[e.type] ?? 0) + 1
    }
    return counts
  }, [entities])

  // Types present in the data (for filter pills)
  const presentTypes = React.useMemo(
    () =>
      (Object.keys(typeCounts) as EntityType[]).sort((a, b) =>
        TYPE_CONFIG[a].label.localeCompare(TYPE_CONFIG[b].label)
      ),
    [typeCounts]
  )

  // Header stats string
  const statsLabel = React.useMemo(() => {
    const total = entities.length
    const parts: string[] = []
    for (const type of (["portfolio", "company", "family_office", "asset_manager", "fund"] as EntityType[])) {
      const count = typeCounts[type]
      if (count) {
        parts.push(
          `${count} ${count === 1 ? TYPE_CONFIG[type].label.toLowerCase() : `${TYPE_CONFIG[type].label.toLowerCase()}s`}`
        )
      }
    }
    return `${total} ${total === 1 ? "entity" : "entities"} · ${parts.join(" · ")}`
  }, [entities, typeCounts])

  // Filtered + sorted list
  const filtered = React.useMemo(() => {
    let list = entities
    if (typeFilter !== "all") {
      list = list.filter((e) => e.type === typeFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((e) => (e.name ?? "").toLowerCase().includes(q))
    }
    return sortEntities(list, sort)
  }, [entities, typeFilter, search, sort])

  // Empty: no entities at all
  if (entities.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutGrid className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No entities yet</EmptyTitle>
          <EmptyDescription>
            Add your first portfolio, company, or other entity to get started.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <AddEntityDialog>
            <Button variant="outline" size="sm">
              Add entity
            </Button>
          </AddEntityDialog>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <p className="text-xs text-muted-foreground">{statsLabel}</p>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Type filter pills */}
        {presentTypes.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setTypeFilter("all")}
              className={cn(
                "h-7 rounded-lg px-2.5 text-xs font-medium transition-colors",
                typeFilter === "all"
                  ? "bg-foreground text-background"
                  : "border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All
            </button>
            {presentTypes.map((type) => {
              const active = typeFilter === type
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(active ? "all" : type)}
                  className={cn(
                    "h-7 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {TYPE_CONFIG[type].label}
                </button>
              )
            })}
          </div>
        )}

        {/* Sort */}
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" className="ml-auto w-fit gap-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid or no-results state */}
      {filtered.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No results</EmptyTitle>
            <EmptyDescription>
              No entities match your current filters. Try adjusting your search or filter.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}
    </div>
  )
}
