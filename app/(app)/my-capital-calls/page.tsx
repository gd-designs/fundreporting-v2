"use client"

import * as React from "react"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CapitalCallSend } from "@/components/capital-call-send"
import { notifyNotificationsUpdate } from "@/lib/ledger-events"

type MyCapitalCall = {
  id: string
  entity: string
  cap_table_entry: string | null
  amount: number | null
  called_at: number | null
  due_date: number | null
  status: "pending" | "partial" | "paid" | null
  notes: string | null
  notified_at: number | null
  acknowledged_at: number | null
  shareholder_name: string | null
  shareholder_id: string | null
  price_per_share: number | number[] | null
  entity_name: string | null
  currency: { id: number; code: string; name: string } | null
  country: { id: number; code: string; name: string } | null
}

function fmt(n: number | null | undefined, currencyCode?: string | null) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currencyCode ?? "EUR" }).format(n)
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
}

export default function MyCapitalCallsPage() {
  const [calls, setCalls] = React.useState<MyCapitalCall[]>([])
  const [loading, setLoading] = React.useState(true)
  const [acknowledging, setAcknowledging] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    fetch("/api/my-capital-calls")
      .then((r) => r.ok ? r.json() : [])
      .then(setCalls)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function acknowledge(id: string) {
    setAcknowledging((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/capital-calls/${id}/acknowledge`, { method: "POST" })
      if (res.ok) {
        setCalls((prev) =>
          prev.map((c) => c.id === id ? { ...c, acknowledged_at: Date.now() } : c)
        )
        notifyNotificationsUpdate()
      }
    } finally {
      setAcknowledging((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  function refresh() {
    fetch("/api/my-capital-calls")
      .then((r) => r.ok ? r.json() : [])
      .then(setCalls)
      .catch(() => {})
  }

  const pending = calls.filter((c) => !c.acknowledged_at)
  const acknowledged = calls.filter((c) => c.acknowledged_at)

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">My Capital Calls</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capital calls issued to you as a shareholder.
        </p>
      </div>

      {calls.length === 0 && (
        <p className="text-sm text-muted-foreground">No capital calls have been issued to you.</p>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Awaiting acknowledgement
          </h2>
          <div className="divide-y rounded-lg border">
            {pending.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium tabular-nums">{fmt(c.amount, c.currency?.code)}</p>
                  <p className="text-xs text-muted-foreground">Due {fmtDate(c.due_date)}</p>
                  {c.called_at && (
                    <p className="text-xs text-muted-foreground">Called {fmtDate(c.called_at)}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status ?? "pending"]}`}>
                    {c.status ?? "pending"}
                  </span>
                  {!c.acknowledged_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledge(c.id)}
                      disabled={acknowledging.has(c.id)}
                    >
                      {acknowledging.has(c.id) ? "Acknowledging…" : "Acknowledge"}
                    </Button>
                  )}
                  <CapitalCallSend capitalCall={c} onSuccess={refresh} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {acknowledged.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Acknowledged
          </h2>
          <div className="divide-y rounded-lg border">
            {acknowledged.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 p-4 opacity-60">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium tabular-nums">{fmt(c.amount, c.currency?.code)}</p>
                  <p className="text-xs text-muted-foreground">Due {fmtDate(c.due_date)}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span>Acknowledged {fmtDate(c.acknowledged_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
