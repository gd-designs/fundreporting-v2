"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { ShareholderDocumentsTab } from "@/components/shareholder-documents-tab"
import type { CapTableShareholder } from "@/lib/cap-table"


// ─── Main sheet ───────────────────────────────────────────────────────────────

export function CapTableInvestorSheet({
  shareholder,
  fundEntityUUID,
  open,
  onOpenChange,
  onUpdated,
}: {
  shareholder: CapTableShareholder | null
  fundEntityUUID: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdated: () => void
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")
  const [idNumber, setIdNumber] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (open && shareholder) {
      setName(shareholder.name ?? "")
      setEmail(shareholder.email ?? "")
      setRole(shareholder.role ?? "")
      setIdNumber(shareholder.id_number ?? "")
      setNotes(shareholder.notes ?? "")
      setSaveError(null)
      setDeleteError(null)
    }
  }, [open, shareholder?.id])

  async function handleSave() {
    if (!shareholder) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/cap-table-shareholders/${shareholder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim() || null,
          role: role || null,
          id_number: idNumber.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      onUpdated()
    } catch {
      setSaveError("Failed to save changes.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!shareholder) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/cap-table-shareholders/${shareholder.id}`, { method: "DELETE" })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error ?? "Failed to remove investor")
      }
      onOpenChange(false)
      onUpdated()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to remove investor.")
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  const typeLabel =
    shareholder?.type === "company" ? "Company" :
    shareholder?.type === "fund" ? "Fund" :
    "Individual"

  const typeClass =
    shareholder?.type === "company" ? "bg-blue-100 text-blue-700" :
    shareholder?.type === "fund" ? "bg-violet-100 text-violet-700" :
    "bg-slate-100 text-slate-700"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-lg p-0">
        <div className="flex flex-col min-h-full">

          {/* Header */}
          <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${typeClass}`}>
                    {typeLabel}
                  </span>
                </div>
                <SheetTitle className="text-lg leading-tight">
                  {shareholder?.name ?? "Investor"}
                </SheetTitle>
                {shareholder?.email && (
                  <SheetDescription className="mt-0.5">{shareholder.email}</SheetDescription>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="flex-1 flex flex-col">
            <TabsList className="shrink-0 w-full justify-start rounded-none border-b bg-transparent px-6 gap-1">
              <TabsTrigger value="overview" className="rounded-md data-[state=active]:bg-muted">
                Overview
              </TabsTrigger>
              <TabsTrigger value="documents" className="rounded-md data-[state=active]:bg-muted">
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Overview tab */}
            <TabsContent value="overview" className="flex-1 px-6 py-5">
              <FieldGroup>
                <Field>
                  <FieldLabel>Name</FieldLabel>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Investor name" />
                </Field>
                <Field>
                  <FieldLabel>{shareholder?.type === "company" ? "UBO email" : "Email"}</FieldLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="investor@example.com"
                  />
                </Field>
                <Field>
                  <FieldLabel>Role</FieldLabel>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investor">Investor</SelectItem>
                      <SelectItem value="ubo">UBO</SelectItem>
                      <SelectItem value="stakeholder">Stakeholder</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>ID / Registration number</FieldLabel>
                  <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Optional" />
                </Field>
                <Field>
                  <FieldLabel>Notes</FieldLabel>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes…"
                    rows={4}
                  />
                </Field>
                {saveError && <FieldError>{saveError}</FieldError>}
              </FieldGroup>

              <div className="mt-5 flex items-center justify-between gap-3">
                <Button disabled={saving || !name.trim()} onClick={handleSave}>
                  {saving ? <><Spinner className="size-3.5 mr-1.5" />Saving…</> : "Save changes"}
                </Button>
                {confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleting}
                      onClick={handleDelete}
                    >
                      {deleting ? "Removing…" : "Confirm remove"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="size-3.5 mr-1.5" />
                    Remove investor
                  </Button>
                )}
              </div>
              {deleteError && (
                <p className="text-sm text-destructive mt-2">{deleteError}</p>
              )}
            </TabsContent>

            {/* Documents tab */}
            <TabsContent value="documents" className="flex-1 px-6 py-5">
              {shareholder && (
                <ShareholderDocumentsTab
                  shareholderId={shareholder.id}
                  entityUUID={fundEntityUUID}
                />
              )}
            </TabsContent>
          </Tabs>

        </div>
      </SheetContent>
    </Sheet>
  )
}
