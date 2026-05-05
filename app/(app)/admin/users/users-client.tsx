"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type User = {
  id: number
  name: string
  email: string
  created_at: string
  is_admin?: boolean
}

type ListResponse = { items?: User[] } | User[]

export function AdminUsersClient() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const url = new URL("/api/admin/users", window.location.origin)
        if (q.trim()) url.searchParams.set("q", q.trim())
        const r = await fetch(url.toString())
        const d = (await r.json().catch(() => ({}))) as ListResponse
        if (cancelled) return
        if (!r.ok) {
          setError("error" in (d as Record<string, unknown>) ? String((d as { error?: string }).error) : "Failed to load users")
          return
        }
        const list = Array.isArray(d) ? d : (d.items ?? [])
        setUsers(list)
        setError(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [q])

  const filtered = users

  async function impersonate(u: User) {
    setError(null)
    setBusyId(u.id)
    try {
      const r = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? "Failed to impersonate")
        return
      }
      router.push("/dashboard")
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <UserCog className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Admin · Users</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>Sign in as another user to view their account. Sessions last 1 hour.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 max-w-md">
            <Input placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Created</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span>{u.name || "—"}</span>
                          {u.is_admin && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <ShieldCheck className="size-3" /> Admin
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === u.id}
                          onClick={() => impersonate(u)}
                        >
                          {busyId === u.id && <Loader2 className="size-3.5 animate-spin" />}
                          Impersonate
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-sm">
                        No users match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
