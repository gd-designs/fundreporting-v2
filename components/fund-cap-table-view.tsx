"use client"

import * as React from "react"
import { fetchCapitalCalls, fetchShareClasses, type CapitalCall, type ShareClass } from "@/lib/cap-table"

function fmtCurrency(n: number | null | undefined, code = "EUR") {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(n)
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

type InvestorRow = {
  capTableEntryId: string
  name: string | null
  email: string | null
  totalDeployed: number
  lastDeployed: number | null
  shareClassName: string | null
}

function buildInvestorRows(calls: CapitalCall[]): InvestorRow[] {
  const deployed = calls.filter((c) => c.deployed_at != null && c.cap_table_entry != null)
  const map = new Map<string, InvestorRow>()

  for (const call of deployed) {
    const entryId = call.cap_table_entry!
    const existing = map.get(entryId)
    const amount = call.amount ?? 0
    const shareholder = call._cap_table_entry?._shareholder

    if (existing) {
      existing.totalDeployed += amount
      if (call.deployed_at && (existing.lastDeployed == null || call.deployed_at > existing.lastDeployed)) {
        existing.lastDeployed = call.deployed_at
      }
      if (!existing.shareClassName && call._share_class?.name) {
        existing.shareClassName = call._share_class.name
      }
    } else {
      map.set(entryId, {
        capTableEntryId: entryId,
        name: shareholder?.name ?? null,
        email: shareholder?.email ?? null,
        totalDeployed: amount,
        lastDeployed: call.deployed_at,
        shareClassName: call._share_class?.name ?? null,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.lastDeployed ?? 0) - (a.lastDeployed ?? 0))
}

export function FundCapTableView({
  entityUUID,
  currencyCode = "EUR",
}: {
  entityUUID: string
  currencyCode?: string
}) {
  const [calls, setCalls] = React.useState<CapitalCall[]>([])
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    Promise.all([fetchCapitalCalls(entityUUID), fetchShareClasses(entityUUID)])
      .then(([c, sc]) => {
        setCalls(c)
        setShareClasses(sc)
      })
      .finally(() => setLoading(false))
  }, [entityUUID])

  const investors = buildInvestorRows(calls)
  const totalDeployed = investors.reduce((sum, r) => sum + r.totalDeployed, 0)
  const totalCalled = calls.reduce((sum, c) => sum + (c.amount ?? 0), 0)

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Investors</p>
            <p className="text-2xl font-semibold tabular-nums mt-0.5">{investors.length}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Called</p>
            <p className="text-2xl font-semibold tabular-nums mt-0.5">{fmtCurrency(totalCalled, currencyCode)}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Deployed</p>
            <p className="text-2xl font-semibold tabular-nums mt-0.5">{fmtCurrency(totalDeployed, currencyCode)}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Share Classes</p>
            <p className="text-2xl font-semibold tabular-nums mt-0.5">{shareClasses.length}</p>
          </div>
        </div>

        {/* Share Classes */}
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-medium text-sm">Share Classes</h3>
          </div>
          <div className="px-4 py-3">
            {shareClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No share classes defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shareClasses.map((sc) => (
                  <div key={sc.id} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
                    <span className="font-medium">{sc.name ?? "—"}</span>
                    {sc.voting_rights && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Voting</span>
                    )}
                    {sc.price_per_share != null && (
                      <span className="text-xs text-muted-foreground">{fmtCurrency(sc.price_per_share, currencyCode)} / share</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Investors Table */}
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-medium text-sm">Cap Table</h3>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : investors.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No capital deployed yet. Use "Deploy to Fund" from an investor's capital call.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Investor</th>
                  <th className="px-4 py-2 text-left font-medium">Share Class</th>
                  <th className="px-4 py-2 text-right font-medium">Total Deployed</th>
                  <th className="px-4 py-2 text-right font-medium">Last Deployment</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {investors.map((row) => (
                  <tr key={row.capTableEntryId} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name ?? "—"}</p>
                      {row.email && (
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.shareClassName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {fmtCurrency(row.totalDeployed, currencyCode)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtDate(row.lastDeployed)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td colSpan={2} className="px-4 py-2 text-xs text-muted-foreground font-medium">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-semibold">
                    {fmtCurrency(totalDeployed, currencyCode)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
