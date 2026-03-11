"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Trash2, Landmark, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { UnifiedEntity } from "@/lib/types"

type FoPortfolioLink = {
  id: string
  family_office: string
  portfolio: string
  label: string | null
  created_at: number | null
}

function AddMemberDialog({
  familyOfficeId,
  unlinkedPortfolios,
  onAdded,
}: {
  familyOfficeId: string
  unlinkedPortfolios: UnifiedEntity[]
  onAdded: (link: FoPortfolioLink) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [portfolioId, setPortfolioId] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function reset() {
    setPortfolioId("")
    setLabel("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!portfolioId) return
    setLoading(true)
    setError(null)
    const res = await fetch("/api/family-office-portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family_office: familyOfficeId,
        portfolio: portfolioId,
        label: label.trim() || null,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      setError("Failed to link portfolio.")
      return
    }
    const link = await res.json() as FoPortfolioLink
    onAdded(link)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        Add portfolio
      </Button>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Link a Portfolio</DialogTitle>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>Portfolio</FieldLabel>
              <Select value={portfolioId} onValueChange={setPortfolioId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a portfolio…" />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedPortfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name ?? "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Label <span className="text-muted-foreground">(optional)</span></FieldLabel>
              <Input
                placeholder="e.g. John's Portfolio, Family Trust"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !portfolioId}>
              {loading && <Spinner className="mr-1" />}
              Link portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FamilyOfficeMembers({
  familyOfficeId,
  familyOfficeName,
  allPortfolios,
}: {
  familyOfficeId: string
  familyOfficeName: string | null
  allPortfolios: UnifiedEntity[]
}) {
  const [links, setLinks] = React.useState<FoPortfolioLink[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch(`/api/family-office-portfolios?family_office=${familyOfficeId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setLinks(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [familyOfficeId])

  const linkedPortfolioIds = new Set(links.map((l) => l.portfolio))
  const unlinkedPortfolios = allPortfolios.filter((p) => !linkedPortfolioIds.has(p.id))

  async function removeLink(linkId: string) {
    if (!window.confirm("Remove this portfolio from the family office?")) return
    const res = await fetch(`/api/family-office-portfolios/${linkId}`, { method: "DELETE" })
    if (res.ok || res.status === 204) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    }
  }

  const portfolioById = React.useMemo(() => {
    const m = new Map<string, UnifiedEntity>()
    for (const p of allPortfolios) m.set(p.id, p)
    return m
  }, [allPortfolios])

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Member Portfolios</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Portfolios linked to {familyOfficeName ?? "this family office"}.
            </p>
          </div>
          {!loading && (
            <AddMemberDialog
              familyOfficeId={familyOfficeId}
              unlinkedPortfolios={unlinkedPortfolios}
              onAdded={(link) => setLinks((prev) => [...prev, link])}
            />
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : links.length === 0 ? (
          <Empty className="border py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Landmark className="size-4" />
              </EmptyMedia>
              <EmptyTitle>No portfolios linked</EmptyTitle>
              <EmptyDescription>
                Link member portfolios to see a consolidated view of family wealth.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <AddMemberDialog
                familyOfficeId={familyOfficeId}
                unlinkedPortfolios={unlinkedPortfolios}
                onAdded={(link) => setLinks((prev) => [...prev, link])}
              />
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => {
              const portfolio = portfolioById.get(link.portfolio)
              return (
                <div
                  key={link.id}
                  className="group flex flex-col gap-4 rounded-xl border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex shrink-0 items-center justify-center rounded-lg p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Landmark className="size-4" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Portfolio</span>
                    </div>
                    <button
                      onClick={() => removeLink(link.id)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors"
                      title="Remove link"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <div className="flex-1">
                    <p className="text-lg font-semibold leading-tight tracking-tight">
                      {link.label ?? portfolio?.name ?? <span className="text-muted-foreground">Unnamed</span>}
                    </p>
                    {link.label && portfolio?.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{portfolio.name}</p>
                    )}
                  </div>

                  {portfolio && (
                    <Link
                      href={`/portfolio/${portfolio.id}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Open portfolio
                      <ArrowUpRight className="size-3" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
