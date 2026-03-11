"use client"

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "urgent"

export type AssignedUser = {
  id: number
  name?: string | null
  email?: string | null
  avatar?: { url?: string } | null
}

export type Task = {
  id: string
  createdAt: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority | null
  dueDate: number | null
  owner: number | null
  assignedTo: number[]
  assignedToUsers: AssignedUser[]
  entityId: string | null
  objectType: string | null
  objectId: string | null
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
}

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"]

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-muted text-muted-foreground line-through",
}

function mapTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== "object") return null
  const t = raw as Record<string, unknown>
  if (typeof t.id !== "string") return null
  return {
    id: t.id,
    createdAt: typeof t.created_at === "number" ? t.created_at : 0,
    title: typeof t.title === "string" ? t.title : "",
    description: typeof t.description === "string" ? t.description : null,
    status: (typeof t.status === "string" ? t.status : "todo") as TaskStatus,
    priority: (typeof t.priority === "string" ? t.priority : null) as TaskPriority | null,
    dueDate: typeof t.due_date === "number" ? t.due_date : null,
    owner: typeof t.owner === "number" ? t.owner : null,
    assignedTo: Array.isArray(t.assigned_to)
      ? (t.assigned_to as unknown[]).map((item) =>
          typeof item === "number" ? item : typeof (item as Record<string, unknown>)?.id === "number" ? (item as Record<string, unknown>).id as number : null
        ).filter((id): id is number => id !== null)
      : [],
    assignedToUsers: Array.isArray(t.assigned_to)
      ? (t.assigned_to as unknown[]).flatMap((item, i) => {
          if (typeof item !== "object" || item === null) return []
          const obj = item as Record<string, unknown>
          // as: "assigned_to._user" → each element has a _user sub-object
          const user = (typeof obj._user === "object" && obj._user !== null ? obj._user : obj) as Record<string, unknown>
          const id = typeof obj.id === "number" ? obj.id : i
          const name = (user.name as string | null | undefined) ?? null
          const email = (user.email as string | null | undefined) ?? null
          const avatar = (typeof user.avatar === "object" && user.avatar !== null ? user.avatar : null) as { url?: string } | null
          return [{ id, name, email, avatar }]
        })
      : [],
    entityId: typeof t.entity === "string" ? t.entity : null,
    objectType: typeof t.object_type === "string" ? t.object_type : null,
    objectId: typeof t.object_id === "string" ? t.object_id : null,
  }
}

export async function fetchTasks(entityId?: string): Promise<Task[]> {
  const url = entityId ? `/api/tasks?entity=${encodeURIComponent(entityId)}` : "/api/tasks"
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return []
  const raw = await res.json()
  return (Array.isArray(raw) ? raw : []).map(mapTask).filter((t): t is Task => t !== null)
}

export async function createTask(data: Partial<Omit<Task, "id" | "createdAt" | "owner">> & { entity?: string }): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? null,
      due_date: data.dueDate ?? null,
      assigned_to: data.assignedTo ?? [],
      entity: data.entity ?? null,
      object_type: data.objectType ?? null,
      object_id: data.objectId ?? null,
    }),
  })
  if (!res.ok) throw new Error("Failed to create task")
  return mapTask(await res.json()) as Task
}

export async function patchTask(id: string, data: Partial<{
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority | null
  due_date: number | null
  assigned_to: number[]
  object_type: string | null
  object_id: string | null
}>): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update task")
  return mapTask(await res.json()) as Task
}

export async function deleteTask(id: string): Promise<void> {
  await fetch(`/api/tasks/${id}`, { method: "DELETE" })
}
