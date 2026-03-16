"use client"

import * as React from "react"
import { Bell, X } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Notification } from "@/lib/notifications"

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [open, setOpen] = React.useState(false)
  const [markingAll, setMarkingAll] = React.useState(false)

  const visible = notifications.filter((n) => !n.dismissed)
  const unread = visible.filter((n) => !n.read).length

  async function fetchNotifications() {
    fetch("/api/notifications")
      .then((r) => r.ok ? r.json() : [])
      .then(setNotifications)
      .catch(() => {})
  }

  async function dismiss(e: React.MouseEvent, n: Notification) {
    e.stopPropagation()
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    await fetch(`/api/notifications/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    })
  }

  // Initial load + listen for external updates (e.g. after acknowledge)
  React.useEffect(() => {
    fetchNotifications()
    window.addEventListener("notifications:update", fetchNotifications)
    return () => window.removeEventListener("notifications:update", fetchNotifications)
  }, [])

  // Re-fetch when popover opens so it's always fresh
  React.useEffect(() => {
    if (open) fetchNotifications()
  }, [open])

  async function handleClick(n: Notification) {
    setOpen(false)
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH" })
      setNotifications((prev) =>
        prev.map((x) => x.id === n.id ? { ...x, read: true } : x)
      )
    }
    if (n.task) {
      router.push(`/tasks?task=${n.task}`)
    } else if (n.type === "capital_call") {
      router.push("/my-capital-calls")
    } else {
      router.push("/tasks")
    }
  }

  async function markAllRead() {
    const unreadItems = visible.filter((n) => !n.read)
    if (!unreadItems.length) return
    setMarkingAll(true)
    await Promise.all(
      unreadItems.map((n) => fetch(`/api/notifications/${n.id}`, { method: "PATCH" }))
    )
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setMarkingAll(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center rounded-md p-1.5 hover:bg-sidebar-accent text-sidebar-foreground">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" alignOffset={-4} sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {markingAll ? "Marking…" : "Mark all read"}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            visible.map((n) => (
              <div
                key={n.id}
                className={`group relative flex items-start gap-3 border-b px-4 py-3 last:border-0 ${n.read ? "opacity-60" : ""}`}
              >
                <button
                  onClick={() => handleClick(n)}
                  className="flex flex-1 items-start gap-3 text-left hover:bg-muted/40 -mx-4 -my-3 px-4 py-3 min-w-0"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
                <button
                  onClick={(e) => dismiss(e, n)}
                  className="absolute right-3 top-3 hidden group-hover:flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
        {visible.length > 0 && (
          <div className="border-t px-4 py-2">
            <button
              onClick={() => { setOpen(false); router.push("/tasks") }}
              className="text-xs text-primary hover:underline"
            >
              View all tasks
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
