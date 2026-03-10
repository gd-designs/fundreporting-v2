"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchEntityMutations, type Mutation } from "@/lib/mutations"
import { fetchEntityAssets, type EntityAsset } from "@/lib/entity-assets"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ms))
}

function sourceLabel(source: Mutation["source"]): string {
  if (source === "return_profile") return "Return profile"
  if (source === "transaction") return "Transaction"
  return "Manual"
}

function sourceBadgeColor(source: Mutation["source"]): string {
  if (source === "return_profile") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
  if (source === "transaction") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  return "bg-muted text-muted-foreground"
}

// ── Component ────────────────────────────────────────────────────────────────

export function MutationsManager({ entityUUID }: { entityUUID: string }) {
  const [mutations, setMutations] = React.useState<Mutation[]>([])
  const [assetMap, setAssetMap] = React.useState<Map<string, EntityAsset>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [muts, assets] = await Promise.all([
        fetchEntityMutations(entityUUID),
        fetchEntityAssets(entityUUID),
      ])
      muts.sort((a, b) => b.date - a.date)
      setMutations(muts)
      setAssetMap(new Map(assets.map((a) => [a.id, a])))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mutations.")
    } finally {
      setLoading(false)
    }
  }, [entityUUID])

  React.useEffect(() => { void load() }, [load])

  async function deleteMutation(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/mutations/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setMutations((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // keep
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  // Stats
  const totalGrowth = mutations.reduce((s, m) => s + (m.delta > 0 ? m.delta : 0), 0)
  const totalDecline = mutations.reduce((s, m) => s + (m.delta < 0 ? Math.abs(m.delta) : 0), 0)
  const netChange = mutations.reduce((s, m) => s + m.delta, 0)

  // Primary currency from most common asset
  const primaryCurrency = React.useMemo(() => {
    for (const m of mutations) {
      const asset = assetMap.get(m.assetId)
      if (asset?.currencyCode) return asset.currencyCode
    }
    return null
  }, [mutations, assetMap])

  return (
    <div className="space-y-6">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total mutations</p>
          <p className="text-2xl font-semibold mt-1">{loading ? "—" : mutations.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Net value change</p>
          <p className={`text-2xl font-semibold mt-1 ${netChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {loading ? "—" : `${netChange >= 0 ? "+" : "−"}${formatAmountWithCurrency(Math.abs(netChange), primaryCurrency)}`}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Growth</p>
              <p className="text-lg font-semibold mt-1 text-emerald-600">
                {loading ? "—" : `+${formatAmountWithCurrency(totalGrowth, primaryCurrency)}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Decline</p>
              <p className="text-lg font-semibold mt-1 text-red-500">
                {loading ? "—" : `−${formatAmountWithCurrency(totalDecline, primaryCurrency)}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mutations list */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">All Mutations</p>
        </div>

        {loading && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && mutations.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No mutations recorded yet.</div>
        )}

        {!loading && mutations.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Asset</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Source</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Delta</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {mutations.map((m) => {
                const asset = assetMap.get(m.assetId)
                const isConfirming = confirmDeleteId === m.id
                const isDeleting = deletingId === m.id

                return (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(m.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{asset?.name || m.assetId.slice(0, 8) + "…"}</div>
                      {asset?.className && (
                        <div className="text-xs text-muted-foreground">{asset.className}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sourceBadgeColor(m.source)}`}>
                        {sourceLabel(m.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`inline-flex items-center gap-1 font-medium ${m.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {m.delta >= 0
                          ? <TrendingUp className="size-3" />
                          : <TrendingDown className="size-3" />
                        }
                        {m.delta >= 0 ? "+" : "−"}
                        {formatAmountWithCurrency(Math.abs(m.delta), asset?.currencyCode ?? null)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {m.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            disabled={isDeleting}
                            onClick={() => deleteMutation(m.id)}
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
                          onClick={() => setConfirmDeleteId(m.id)}
                          title="Delete mutation"
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
                <td colSpan={3} className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Net change</td>
                <td className={`px-4 py-2 text-right tabular-nums ${netChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {netChange >= 0 ? "+" : "−"}{formatAmountWithCurrency(Math.abs(netChange), primaryCurrency)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
