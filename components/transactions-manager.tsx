"use client"

import * as React from "react"
import { ArrowDownLeft, ArrowUpRight, Paperclip, Pencil, Plus, Trash2 } from "lucide-react"
import { AddTransactionDialog } from "@/components/add-transaction-dialog"
import { EditTransactionDialog } from "@/components/edit-transaction-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DocumentList } from "@/components/document-list"
import { UploadDocumentsDialog } from "@/components/upload-documents-dialog"
import { type EntityDocument } from "@/lib/documents"
import {
  fetchEntityTransactions,
  formatAmountWithCurrency,
  formatTxDate,
  type EntityTransaction,
} from "@/lib/entity-transactions"

// ── Helpers ─────────────────────────────────────────────────────────────────

function typeColor(typeName: string): string {
  const t = typeName.toLowerCase()
  if (t === "buy" || t === "transfer in") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
  if (t === "sell" || t === "sale" || t === "transfer out") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
  if (t.includes("income") || t.includes("dividend") || t.includes("distribution")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
  if (t.includes("expense") || t.includes("fee")) return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
  return "bg-muted text-muted-foreground"
}

function entryTypeBadgeColor(entryType: string): string {
  const t = entryType.toLowerCase()
  if (t === "cash") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  if (t === "asset") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
  if (t === "income") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
  if (t === "expense" || t === "fee") return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
  return "bg-muted text-muted-foreground"
}

function computeStats(transactions: EntityTransaction[]) {
  let capitalIn = 0
  let withdrawals = 0

  for (const tx of transactions) {
    const typeLower = tx.typeName.toLowerCase()
    const isNewMoney = typeLower.includes("new money") || typeLower.includes("capital") || typeLower.includes("deposit")
    const isWithdrawal = typeLower.includes("withdrawal") || typeLower.includes("withdraw") || typeLower.includes("distribution")

    for (const leg of tx.legs) {
      if (leg.entryType === "cash") {
        if (isNewMoney && leg.direction === "in") capitalIn += leg.amount
        else if (isWithdrawal && leg.direction === "out") withdrawals += leg.amount
      }
    }
  }

  return { capitalIn, withdrawals }
}

// ── Main component ───────────────────────────────────────────────────────────

function TransactionDocsDialog({
  open,
  onClose,
  entityUUID,
  transactionId,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  transactionId: string
}) {
  const [docs, setDocs] = React.useState<EntityDocument[]>([])
  const [loading, setLoading] = React.useState(false)

  const loadDocs = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents?entity=${entityUUID}&object_type=transaction&object_id=${transactionId}`)
      const data = (await res.json()) as { documents?: unknown[] }
      const raw = Array.isArray(data.documents) ? data.documents : []
      setDocs(raw.filter((d): d is EntityDocument => !!d && typeof (d as EntityDocument).id === "string") as EntityDocument[])
    } finally {
      setLoading(false)
    }
  }, [entityUUID, transactionId])

  React.useEffect(() => {
    if (open) void loadDocs()
  }, [open, loadDocs])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Documents</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && docs.length === 0 && (
            <p className="text-sm text-muted-foreground">No documents attached yet.</p>
          )}
          {!loading && docs.length > 0 && (
            <DocumentList documents={docs} onUpdated={loadDocs} />
          )}
          <UploadDocumentsDialog
            entityId={entityUUID}
            objectType="transaction"
            objectId={transactionId}
            onUploaded={loadDocs}
          >
            <Button size="sm" variant="outline" className="w-full gap-1.5">
              <Plus className="size-3.5" />
              Upload document
            </Button>
          </UploadDocumentsDialog>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TransactionsManager({ entityUUID }: { entityUUID: string }) {
  const [transactions, setTransactions] = React.useState<EntityTransaction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [docsDialogTxId, setDocsDialogTxId] = React.useState<string | null>(null)
  const [editTx, setEditTx] = React.useState<EntityTransaction | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const txs = await fetchEntityTransactions(entityUUID)
      txs.sort((a, b) => b.date - a.date)
      setTransactions(txs)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions.")
    } finally {
      setLoading(false)
    }
  }, [entityUUID])

  React.useEffect(() => { void load() }, [load])

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function deleteTransaction(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error ?? "Failed to delete")
      }
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      console.error("[delete-transaction]", e)
      alert(e instanceof Error ? e.message : "Failed to delete transaction")
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const sorted = transactions
  const stats = React.useMemo(() => computeStats(transactions), [transactions])

  // Detect primary currency from first cash leg
  const primaryCurrency = React.useMemo(() => {
    for (const tx of transactions) {
      for (const leg of tx.legs) {
        if (leg.currencyCode) return leg.currencyCode
      }
    }
    return null
  }, [transactions])

  return (
    <div className="space-y-6">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Transactions</p>
          <p className="text-2xl font-semibold mt-1">{loading ? "—" : transactions.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Capital In</p>
          <p className={`text-2xl font-semibold mt-1 ${stats.capitalIn > 0 ? "text-emerald-600" : ""}`}>
            {loading ? "—" : `+${formatAmountWithCurrency(stats.capitalIn, primaryCurrency)}`}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Withdrawals</p>
          <p className={`text-2xl font-semibold mt-1 ${stats.withdrawals > 0 ? "text-red-600" : ""}`}>
            {loading ? "—" : `−${formatAmountWithCurrency(stats.withdrawals, primaryCurrency)}`}
          </p>
        </div>
      </div>

      {/* Transactions list */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">All Transactions</p>
          <AddTransactionDialog entityUUID={entityUUID} onSuccess={() => void load()}>
            <Button size="sm" className="h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add transaction
            </Button>
          </AddTransactionDialog>
        </div>

        {loading && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No transactions yet.</div>
        )}

        {!loading && sorted.map((tx) => {
          const expanded = expandedIds.has(tx.id)
          const isDeleting = deletingId === tx.id
          const isConfirming = confirmDeleteId === tx.id

          return (
            <div key={tx.id} className="border-b last:border-b-0">
              {/* Transaction header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(tx.id)}
              >
                <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor(tx.typeName)}`}>
                  {tx.typeName || "—"}
                </span>
                <span className="text-sm font-medium truncate min-w-0 flex-1">
                  {tx.reference || "—"}
                </span>
                <span className="shrink-0 text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  #{tx.id}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatTxDate(tx.date)}
                </span>

                <button
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => { e.stopPropagation(); setDocsDialogTxId(tx.id) }}
                  title="Documents"
                >
                  <Paperclip className="size-3.5" />
                </button>

                <button
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => { e.stopPropagation(); setEditTx(tx) }}
                  title="Edit transaction"
                >
                  <Pencil className="size-3.5" />
                </button>

                {isConfirming ? (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 px-2 text-xs"
                      disabled={isDeleting}
                      onClick={() => deleteTransaction(tx.id)}
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
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(tx.id) }}
                    title="Delete transaction"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Expanded legs */}
              {expanded && (
                <div className="px-4 pb-3 space-y-1.5">
                  {tx.legs.map((leg) => (
                    <div key={leg.id} className="flex items-center gap-2 text-xs">
                      {leg.direction === "in" ? (
                        <ArrowDownLeft className="size-3 shrink-0 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="size-3 shrink-0 text-red-500" />
                      )}
                      <span className="w-36 truncate text-sm">{leg.assetName || leg.objectName || "—"}</span>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${entryTypeBadgeColor(leg.entryType)}`}>
                        {leg.entryTypeLabel || leg.entryType || "—"}
                      </span>
                      <span className={`tabular-nums font-medium ${leg.direction === "in" ? "text-emerald-600" : "text-red-500"}`}>
                        {leg.direction === "in" ? "+" : "−"}
                        {formatAmountWithCurrency(leg.amount, leg.currencyCode)}
                      </span>
                      <span className="text-muted-foreground truncate">{leg.entityName || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {docsDialogTxId && (
        <TransactionDocsDialog
          open={!!docsDialogTxId}
          onClose={() => setDocsDialogTxId(null)}
          entityUUID={entityUUID}
          transactionId={docsDialogTxId}
        />
      )}

      <EditTransactionDialog
        open={!!editTx}
        onClose={() => setEditTx(null)}
        transaction={editTx}
        entityUUID={entityUUID}
        onSaved={() => { setEditTx(null); void load() }}
      />
    </div>
  )
}
