"use client"

import * as React from "react"
import { Shield } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { CapitalCallReceive } from "@/components/capital-call-receive"
import type { CapTableShareholder, CapitalCall, ShareClass } from "@/lib/cap-table"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shareholder: CapTableShareholder | null
  capitalCalls: CapitalCall[]
  shareClasses: ShareClass[]
  entityUUID: string
  entityName?: string
  currencyCode?: string
  onUpdated: () => void
}

function fmtCurrency(n: number | null | undefined, code = "EUR") {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  partial: "bg-yellow-100 text-yellow-700",
  paid: "bg-emerald-100 text-emerald-800",
}

export function ShareholderSheet({
  open,
  onOpenChange,
  shareholder,
  capitalCalls,
  shareClasses,
  entityUUID,
  entityName,
  currencyCode = "EUR",
  onUpdated,
}: Props) {
  if (!shareholder) return null

  const roleLabel = shareholder.role
    ? shareholder.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto w-[480px]! p-0">
        <div className="flex flex-col">
          <SheetHeader className="shrink-0 px-4 pt-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <SheetTitle>{shareholder.name ?? "Shareholder"}</SheetTitle>
              {shareholder.is_ubo && (
                <span title="UBO">
                  <Shield className="size-3.5 text-amber-500" />
                </span>
              )}
            </div>
            <SheetDescription>
              {[shareholder.type ? (shareholder.type === "individual" ? "Individual" : "Company") : null, roleLabel, shareholder.email]
                .filter(Boolean)
                .join(" · ")}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 py-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Capital Calls</p>

              {capitalCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No capital calls yet.</p>
              ) : (
                <div className="space-y-2">
                  {capitalCalls.map(cc => {
                    const sc = shareClasses.find(s => s.id === cc.share_class)
                    const isSettled = cc.status === "paid" && cc.received_at != null
                    const isDeployed = cc.deployed_at != null
                    const statusLabel = isSettled ? "Settled" : (cc.status ?? "pending")

                    return (
                      <div key={cc.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium tabular-nums">
                              {fmtCurrency(cc.amount, currencyCode)}
                            </p>
                            {sc && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {sc.name}{sc.current_nav != null ? ` · ${fmtCurrency(sc.current_nav, currencyCode)}/share` : ""}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Called {fmtDate(cc.called_at)}
                              {cc.due_date ? ` · Due ${fmtDate(cc.due_date)}` : ""}
                            </p>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[cc.status ?? "pending"]}`}>
                            {statusLabel}
                          </span>
                        </div>

                        {isSettled && !isDeployed && (
                          <div className="pt-1 border-t flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              Received {fmtDate(cc.received_at)} · Inject into {entityName ?? "company"}
                            </p>
                            <CapitalCallReceive
                              capitalCall={cc}
                              entityUUID={entityUUID}
                              currencyCode={currencyCode}
                              label="Inject"
                              onSuccess={onUpdated}
                            />
                          </div>
                        )}

                        {isDeployed && (
                          <div className="pt-1 border-t">
                            <p className="text-xs text-muted-foreground">
                              Deployed {fmtDate(cc.deployed_at)}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
