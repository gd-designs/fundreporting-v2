"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { fetchEntityLiabilities, type Liability } from "@/lib/liabilities"
import { fetchEntityAssets, type EntityAsset } from "@/lib/entity-assets"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"
import { LiabilitySheet } from "@/components/liability-sheet"
import { computeAll, type PaymentScheme } from "@/lib/amortization"

// ── Helpers ───────────────────────────────────────────────────────────────────

type PaidInfo = { count: number; lastDate: number | null }

function getOutstanding(l: Liability, paidCount: number): number {
  const p = l.loan_amount ?? 0
  if (paidCount === 0 || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return p
  const periods = computeAll(p, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[Math.min(paidCount, l.term_length) - 1]?.closing ?? p
}

function getNextPayment(l: Liability, paidCount: number): number | null {
  if (!l.loan_amount || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return null
  if (paidCount >= l.term_length) return null
  const periods = computeAll(l.loan_amount, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[paidCount]?.payment ?? null
}

function schemeBadgeColor(scheme: string | null | undefined): string {
  if (scheme === "linear") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  if (scheme === "annuity") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
  if (scheme === "bullet") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
  return "bg-muted text-muted-foreground"
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ms))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiabilitiesManager({ entityUUID, initialLiabilityId, allowNewMoneyIn = false }: { entityUUID: string; initialLiabilityId?: string; allowNewMoneyIn?: boolean }) {
  const [liabilities, setLiabilities] = React.useState<Liability[]>([])
  const [assetMap, setAssetMap] = React.useState<Map<string, EntityAsset>>(new Map())
  const [paidMap, setPaidMap] = React.useState<Map<string, PaidInfo>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [sheetLiability, setSheetLiability] = React.useState<Liability | null>(null)
  const [sheetDefaultTab, setSheetDefaultTab] = React.useState("overview")
  const router = useRouter()
  const pathname = usePathname()

  function openSheet(l: Liability, tab = "overview") {
    setSheetDefaultTab(tab)
    setSheetLiability(l)
  }

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [libs, assets, entriesPayload] = await Promise.all([
        fetchEntityLiabilities(entityUUID),
        fetchEntityAssets(entityUUID),
        fetch(`/api/transaction-entries?entity=${entityUUID}`).then((r) => r.ok ? r.json() : { entries: [] }),
      ])
      libs.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      setLiabilities(libs)
      setAssetMap(new Map(assets.map((a) => [a.id, a])))

      // Build paid periods map per liability
      const rawEntries = Array.isArray((entriesPayload as { entries?: unknown[] }).entries)
        ? (entriesPayload as { entries: Record<string, unknown>[] }).entries
        : []
      const pm = new Map<string, PaidInfo>()
      for (const e of rawEntries) {
        if (e.entry_type !== "principal" || e.direction !== "out" || e.object_type !== "liability") continue
        const objId = typeof e.object_id === "string" ? e.object_id : null
        if (!objId) continue
        const tx = e._transaction as Record<string, unknown> | undefined
        const txDate = tx && typeof tx.date === "number" ? tx.date : null
        const existing = pm.get(objId) ?? { count: 0, lastDate: null }
        pm.set(objId, {
          count: existing.count + 1,
          lastDate: txDate != null ? Math.max(existing.lastDate ?? 0, txDate) : existing.lastDate,
        })
      }
      setPaidMap(pm)
      // Auto-open sheet if initialLiabilityId is provided
      if (initialLiabilityId) {
        const match = libs.find((l) => l.id === initialLiabilityId)
        if (match) setSheetLiability(match)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load liabilities.")
    } finally {
      setLoading(false)
    }
  }, [entityUUID, initialLiabilityId])

  React.useEffect(() => { void load() }, [load])

  async function deleteLiability(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/liabilities/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setLiabilities((prev) => prev.filter((l) => l.id !== id))
    } catch {
      // keep
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  // Stats
  const totalOutstanding = liabilities.reduce((s, l) => {
    const paid = paidMap.get(l.id)
    return s + getOutstanding(l, paid?.count ?? 0)
  }, 0)

  // Cache liabilities value for dashboard entity cards
  React.useEffect(() => {
    if (loading) return
    fetch(`/api/entity-stats/${entityUUID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liabilitiesValue: totalOutstanding }),
    }).catch(() => {})
  }, [loading, entityUUID, totalOutstanding]) // eslint-disable-line react-hooks/exhaustive-deps

  const avgRate = liabilities.length > 0
    ? liabilities.reduce((s, l) => s + (l.interest_rate ?? 0), 0) / liabilities.filter((l) => l.interest_rate != null).length
    : 0

  // Primary currency from most common linked asset
  const primaryCurrency = React.useMemo(() => {
    for (const l of liabilities) {
      if (l.asset) {
        const asset = assetMap.get(l.asset)
        if (asset?.currencyCode) return asset.currencyCode
      }
    }
    return null
  }, [liabilities, assetMap])

  return (
    <>
    <LiabilitySheet
      liability={sheetLiability}
      open={!!sheetLiability}
      onOpenChange={(v) => { if (!v) setSheetLiability(null) }}
      assetName={sheetLiability?.asset ? assetMap.get(sheetLiability.asset)?.name : null}
      defaultTab={sheetDefaultTab}
      allowNewMoneyIn={allowNewMoneyIn}
    />
    <div className="space-y-6">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total liabilities</p>
          <p className="text-2xl font-semibold mt-1">{loading ? "—" : liabilities.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total outstanding</p>
          <p className="text-2xl font-semibold mt-1 text-red-500">
            {loading ? "—" : formatAmountWithCurrency(totalOutstanding, primaryCurrency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg interest rate</p>
          <p className="text-2xl font-semibold mt-1">
            {loading ? "—" : liabilities.some((l) => l.interest_rate != null) ? `${avgRate.toFixed(2)}%` : "—"}
          </p>
        </div>
      </div>

      {/* Liabilities list */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">All Liabilities</p>
        </div>

        {loading && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && liabilities.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No liabilities recorded yet.</div>
        )}

        {!loading && liabilities.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Asset</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Scheme</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Outstanding</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last payment</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Next payment</th>
                <th className="px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Manage</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {liabilities.map((l) => {
                const asset = l.asset ? assetMap.get(l.asset) : undefined
                const isConfirming = confirmDeleteId === l.id
                const isDeleting = deletingId === l.id

                const paid = paidMap.get(l.id)
                const paidCount = paid?.count ?? 0
                const outstanding = getOutstanding(l, paidCount)
                const nextPayment = getNextPayment(l, paidCount)

                return (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.name || "—"}</div>
                      {l.reference && (
                        <div className="text-xs text-muted-foreground">{l.reference}</div>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 cursor-pointer hover:underline"
                      onClick={() => {
                        if (!asset) return
                        const base = pathname.split("/").slice(0, -1).join("/")
                        router.push(`${base}/assets?asset=${asset.id}`)
                      }}
                    >
                      {asset ? (
                        <>
                          <div className="font-medium">{asset.name || "—"}</div>
                          {asset.className && (
                            <div className="text-xs text-muted-foreground">{asset.className}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.scheme ? (
                        <button
                          type="button"
                          onClick={() => openSheet(l, "scheme")}
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${schemeBadgeColor(l.scheme)}`}
                        >
                          {l.scheme}
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">
                      {l.loan_amount != null
                        ? formatAmountWithCurrency(outstanding, asset?.currencyCode ?? null)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {paid?.lastDate ? formatDate(paid.lastDate) : "—"}
                      {paidCount > 0 && (
                        <div className="text-xs text-muted-foreground">{paidCount} paid</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {nextPayment != null
                        ? formatAmountWithCurrency(nextPayment, asset?.currencyCode ?? null)
                        : paidCount > 0 && l.term_length != null && paidCount >= l.term_length
                          ? <span className="text-xs text-green-600 font-medium">Paid off</span>
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => openSheet(l)}
                      >
                        Manage
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            disabled={isDeleting}
                            onClick={() => deleteLiability(l.id)}
                          >
                            {isDeleting ? "…" : "Delete"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => setConfirmDeleteId(l.id)}
                          title="Delete liability"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td colSpan={3} className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Total outstanding</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-500">
                  {formatAmountWithCurrency(totalOutstanding, primaryCurrency)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
    </>
  )
}
