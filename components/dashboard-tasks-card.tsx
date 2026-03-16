"use client"

import * as React from "react"
import Link from "next/link"
import { ListTodo } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TaskSheet, type Task } from "@/components/task-sheet"

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
}

export function DashboardTasksCard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks)
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  function openTask(task: Task) {
    setSelectedTask(task)
    setSheetOpen(true)
  }

  function handleUpdated(updated: Task) {
    setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t)
      .filter(t => t.status !== "done" && t.status !== "cancelled"))
    setSelectedTask(updated)
  }

  function handleDeleted(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Tasks quick look</CardTitle>
          <Button asChild variant="link" className="h-auto px-0 text-xs">
            <Link href="/tasks">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No open tasks.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {tasks.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTask(t)}
                  className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/40 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <p className="truncate text-sm font-medium">{t.title ?? "Untitled task"}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.due_date && (
                      <span className={`text-xs ${new Date(t.due_date) < new Date() ? "text-red-600" : "text-muted-foreground"}`}>
                        {new Date(t.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                    {t.priority && (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? "bg-slate-100 text-slate-600"}`}>
                        {t.priority}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href="/tasks">
              <ListTodo />
              View all tasks
            </Link>
          </Button>
        </CardContent>
      </Card>

      <TaskSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </>
  )
}
