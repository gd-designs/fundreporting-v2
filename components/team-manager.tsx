"use client"

import * as React from "react"
import { MoreHorizontal, Plus, Trash2, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Role = "owner" | "admin" | "member" | "viewer"
type Department =
  | "investor_relations"
  | "asset_management"
  | "compliance"
  | "finance"
  | "legal"

type Member = {
  id: string
  entity: string
  user: number
  role: Role | null
  department: Department | null
  joined_at: number | null
  _user?: { name?: string | null; email?: string | null }
}

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

const DEPT_LABELS: Record<Department, string> = {
  investor_relations: "Investor Relations",
  asset_management: "Asset Management",
  compliance: "Compliance",
  finance: "Finance",
  legal: "Legal",
}

const ROLE_BADGE_VARIANT: Record<Role, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "default",
  member: "secondary",
  viewer: "outline",
}

function formatDate(ts: number | null) {
  if (!ts) return "—"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

function AddMemberDialog({
  entityUUID,
  entityName,
  onAdded,
}: {
  entityUUID: string
  entityName?: string | null
  onAdded: (member: Member) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<Role>("member")
  const [department, setDepartment] = React.useState<Department | "">("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/entity-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: entityUUID,
          email,
          role,
          department: department || null,
          joined_at: Date.now(),
          entityName: entityName ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to add member.")
        return
      }
      onAdded(data as Member)
      setOpen(false)
      setEmail("")
      setRole("member")
      setDepartment("")
    } catch {
      setError("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">The user must already have a platform account.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full" id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Department <span className="text-muted-foreground">(optional)</span></Label>
            <Select value={department || "none"} onValueChange={(v) => setDepartment(v === "none" ? "" : v as Department)}>
              <SelectTrigger className="w-full" id="department">
                <SelectValue placeholder="No department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {(Object.keys(DEPT_LABELS) as Department[]).map((d) => (
                  <SelectItem key={d} value={d}>{DEPT_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add member"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditMemberDialog({
  member,
  onUpdated,
}: {
  member: Member
  onUpdated: (updated: Member) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>(member.role ?? "member")
  const [department, setDepartment] = React.useState<Department | "">(member.department ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/entity-members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, department: department || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to update member.")
        return
      }
      onUpdated({ ...member, ...data })
      setOpen(false)
    } catch {
      setError("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true) }}>
          <UserCheck className="size-4" />
          Edit role
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-dept">Department</Label>
            <Select value={department || "none"} onValueChange={(v) => setDepartment(v === "none" ? "" : v as Department)}>
              <SelectTrigger id="edit-dept">
                <SelectValue placeholder="No department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {(Object.keys(DEPT_LABELS) as Department[]).map((d) => (
                  <SelectItem key={d} value={d}>{DEPT_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamManager({ entityUUID, entityName }: { entityUUID: string; entityName?: string | null }) {
  const [members, setMembers] = React.useState<Member[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch(`/api/entity-members?entity=${entityUUID}`)
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [entityUUID])

  async function handleRemove(member: Member) {
    if (!confirm(`Remove ${member._user?.name ?? "this member"} from the team?`)) return
    setMembers((prev) => prev.filter((m) => m.id !== member.id))
    const res = await fetch(`/api/entity-members/${member.id}`, { method: "DELETE" })
    if (!res.ok) {
      // Restore on failure
      setMembers((prev) => [...prev, member])
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage access and roles for this asset manager.</p>
        </div>
        <AddMemberDialog entityUUID={entityUUID} entityName={entityName} onAdded={(m) => setMembers((prev) => [...prev, m])} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : members.length === 0 ? (
        <div className="border rounded-lg py-16 text-center">
          <p className="text-sm text-muted-foreground">No team members yet. Add someone to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member._user?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{member._user?.email ?? "—"}</TableCell>
                  <TableCell>
                    {member.role ? (
                      <Badge variant={ROLE_BADGE_VARIANT[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.department ? DEPT_LABELS[member.department] : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(member.joined_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <EditMemberDialog
                          member={member}
                          onUpdated={(updated) =>
                            setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
                          }
                        />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => handleRemove(member)}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
