"use client"

import * as React from "react"
import { FundNavManager } from "@/components/fund-nav-manager"
import { FundNavSheet } from "@/components/fund-nav-sheet"
import { TableProperties, Settings2 } from "lucide-react"

export function FundNavPageClient({
  entityUUID,
  currencyCode,
  periodFrequency,
}: {
  entityUUID: string
  currencyCode: string
  periodFrequency: string | null
}) {
  const [view, setView] = React.useState<"manage" | "sheet">("manage")

  return (
    <div className="flex flex-col gap-6">
      {/* ── View toggle ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 self-start rounded-lg border p-1 bg-muted/30">
        <button
          type="button"
          onClick={() => setView("manage")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "manage"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="size-4" />
          Manage
        </button>
        <button
          type="button"
          onClick={() => setView("sheet")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "sheet"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <TableProperties className="size-4" />
          NAV Sheet
        </button>
      </div>

      {view === "manage" ? (
        <FundNavManager entityUUID={entityUUID} currencyCode={currencyCode} periodFrequency={periodFrequency} />
      ) : (
        <FundNavSheet entityUUID={entityUUID} currencyCode={currencyCode} />
      )}
    </div>
  )
}
