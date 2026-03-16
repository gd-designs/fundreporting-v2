"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Calendar,
  Check,
  Circle,
  Landmark,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  type Task,
  type TaskStatus,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  fetchTasks,
} from "@/lib/tasks"
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
  tasks: Task[]
}

const ALL_TAB = "__all__"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

function isOverdue(task: Task) {
  return task.dueDate != null && task.dueDate < Date.now() && task.status !== "done" && task.status !== "cancelled"
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "done") return <Check className="size-3.5 text-green-600" />
  if (status === "in_progress") return <Circle className="size-3.5 text-blue-500 fill-blue-100" />
  if (status === "cancelled") return <AlertCircle className="size-3.5 text-muted-foreground" />
  return <Circle className="size-3.5 text-muted-foreground" />
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

function TaskRow({
  task,
  showPortfolio,
  portfolioName,
  portfolioId,
}: {
  task: Task
  showPortfolio: boolean
  portfolioName: string
  portfolioId: string
}) {
  const overdue = isOverdue(task)

  return (
    <div className="flex items-start gap-3 rounded-md border px-4 py-3 hover:bg-muted/20">
      <div className="mt-0.5 shrink-0">
        <StatusIcon status={task.status} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium truncate ${task.status === "done" || task.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
            {task.title || "Untitled"}
          </p>
          {task.priority && (
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {task.dueDate != null && (
            <span className={`flex items-center gap-1 text-xs ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
              <Calendar className="size-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group by status
// ---------------------------------------------------------------------------

function TaskGroup({
  status,
  tasks,
  showPortfolio,
  getPortfolioName,
  getPortfolioId,
}: {
  status: TaskStatus
  tasks: Task[]
  showPortfolio: boolean
  getPortfolioName: (entityId: string) => string
  getPortfolioId: (entityId: string) => string
}) {
  const [collapsed, setCollapsed] = React.useState(status === "done" || status === "cancelled")
  if (tasks.length === 0) return null
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
        <span>{tasks.length}</span>
      </button>
      {!collapsed && (
        <div className="space-y-1.5 pt-1">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              showPortfolio={showPortfolio}
              portfolioName={getPortfolioName(task.entityId ?? "")}
              portfolioId={getPortfolioId(task.entityId ?? "")}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FamilyOfficeTasks({
  familyOfficeId,
  allPortfolios,
}: {
  familyOfficeId: string
  allPortfolios: UnifiedEntity[]
}) {
  const [slices, setSlices] = React.useState<PortfolioSlice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState(ALL_TAB)

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
              return { linkId: link.id, portfolioId: link.portfolio, portfolioEntityId: entityId, portfolioName: name, tasks: [] }
            }

            const tasks = await fetchTasks(entityId).catch(() => [] as Task[])
            return { linkId: link.id, portfolioId: link.portfolio, portfolioEntityId: entityId, portfolioName: name, tasks }
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

  const allTasks = React.useMemo(() => slices.flatMap((s) => s.tasks), [slices])
  const activeSlice = activeTab === ALL_TAB ? null : slices.find((s) => s.linkId === activeTab)
  const displayTasks = activeSlice ? activeSlice.tasks : allTasks
  const showPortfolio = activeTab === ALL_TAB

  const grouped = React.useMemo(() => {
    const map = new Map<TaskStatus, Task[]>()
    for (const status of STATUS_ORDER) map.set(status, [])
    for (const task of displayTasks) {
      const bucket = map.get(task.status) ?? []
      bucket.push(task)
      map.set(task.status, bucket)
    }
    return map
  }, [displayTasks])

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
            <EmptyDescription>Link portfolios from the Members page to see aggregated tasks here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const open = (grouped.get("todo")?.length ?? 0) + (grouped.get("in_progress")?.length ?? 0)

  return (
    <div className="p-6 md:p-8 space-y-4">
      {/* Summary card */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Aggregated across all member portfolios. Read-only view.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Open Tasks</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{open}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {displayTasks.length} total
              {activeSlice ? ` · ${activeSlice.portfolioName}` : ` · ${slices.length} portfolios`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio tiles + task list */}
      <Card>
        <CardHeader>
          <CardTitle>Task Sheets</CardTitle>
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
              <p className="font-semibold text-sm">All Tasks</p>
              <p className="mt-1 text-xl tabular-nums">{allTasks.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {slices.length} {slices.length === 1 ? "portfolio" : "portfolios"}
              </p>
            </button>

            {slices.map((slice) => {
              const sliceOpen = slice.tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length
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
                  <p className="mt-1 text-xl tabular-nums">{slice.tasks.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sliceOpen} open</p>
                </button>
              )
            })}
          </div>

          {/* Task list grouped by status */}
          {displayTasks.length === 0 ? (
            <Empty className="border py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Circle className="size-4" /></EmptyMedia>
                <EmptyTitle>No tasks</EmptyTitle>
                <EmptyDescription>
                  {activeSlice ? `${activeSlice.portfolioName} has no tasks.` : "No tasks across member portfolios."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              {STATUS_ORDER.map((status) => (
                <TaskGroup
                  key={status}
                  status={status}
                  tasks={grouped.get(status) ?? []}
                  showPortfolio={showPortfolio}
                  getPortfolioName={(entityId) => entityToPortfolio.get(entityId)?.name ?? ""}
                  getPortfolioId={(entityId) => entityToPortfolio.get(entityId)?.portfolioId ?? ""}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
