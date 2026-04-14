"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, BarChart3, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchEntityTransactions, type EntityTransaction, type TransactionLeg } from "@/lib/entity-transactions"
import { fetchEntityLiabilities, type Liability } from "@/lib/liabilities"
import { AddPnlItemDialog, type PnlItem, type PnlCategory, PNL_CATEGORY_LABELS } from "@/components/add-pnl-item-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type FundPeriod = {
  id: string
  label?: string | null
  status?: "open" | "closed" | null
  opened_at?: number | null
  closed_at?: number | null
  management_fee_total?: number | null
  pnl_costs?: number | null
  nav_start?: number | null
  nav_end?: number | null
  nav_gross_end?: number | null
  total_shares_start?: number | null
}

// Entry types that map to each P&L category
const REVENUE_ENTRY_TYPES = new Set(["income", "dividend", "distribution", "rental_income", "rental", "revenue", "interest_received"])
const COGS_ENTRY_TYPES = new Set(["expense", "cost", "insurance", "maintenance", "repair", "property_expense", "direct_cost"])
const OPEX_ENTRY_TYPES = new Set(["fee", "management_fee", "admin_fee", "operating_expense", "professional_fee", "administration"])
const INTEREST_ENTRY_TYPES = new Set(["interest", "interest_income", "interest_expense", "interest_paid"])

type FundFee = {
  id: string
  entity?: string | null
  period?: string | null
  cap_table_entry?: string | null
  amount?: number | null
  fee_per_share?: number | null
  shares_outstanding?: number | null
  status?: "accrued" | "paid" | null
  accrued_at?: number | null
  _cap_table_entry?: {
    id: string
    _shareholder?: { id: string; name?: string | null } | null
  } | null
  _period?: { id: string; label?: string | null } | null
  _share_class_fee?: { id: string; type?: string | null; rate?: number | null; basis?: string | null } | null
}

type LineItem = {
  id: string
  label: string
  amount: number // always positive
  source: "transaction" | "period" | "liability" | "manual" | "fee"
  sourceLabel?: string
  date?: number | null
  manualItem?: PnlItem
}

type PnlData = {
  grossRevenue: LineItem[]
  cogs: LineItem[]
  operatingExpenses: LineItem[]
  interestIncome: LineItem[]
  interestExpense: LineItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCcy(n: number | null | undefined, code: string) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(n)
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function periodLabel(p: FundPeriod, idx: number) {
  return p.label ?? `Period ${idx + 1}`
}

function sum(items: LineItem[]) {
  return items.reduce((s, i) => s + i.amount, 0)
}

/** Annualised interest for a liability prorated over a date range (ms timestamps) */
function liabilityInterestForRange(l: Liability, fromMs: number, toMs: number): number {
  if (!l.loan_amount || !l.interest_rate) return 0
  const years = (toMs - fromMs) / (365.25 * 24 * 3600 * 1000)
  return l.loan_amount * (l.interest_rate / 100) * years
}

function categorizeLeg(leg: TransactionLeg): PnlCategory | null {
  const t = leg.entryType.toLowerCase().replace(/\s+/g, "_")
  if (leg.direction === "in" && REVENUE_ENTRY_TYPES.has(t)) return "gross_revenue"
  if (leg.direction === "in" && INTEREST_ENTRY_TYPES.has(t)) return "interest_income"
  if (leg.direction === "out" && INTEREST_ENTRY_TYPES.has(t)) return "interest_expense"
  if (leg.direction === "out" && COGS_ENTRY_TYPES.has(t)) return "cogs"
  if (leg.direction === "out" && OPEX_ENTRY_TYPES.has(t)) return "operating_expense"
  return null
}

function txDateInRange(tx: EntityTransaction, fromMs: number | null, toMs: number | null) {
  if (fromMs == null || toMs == null) return true
  return tx.date >= fromMs && tx.date <= toMs
}

// ─── Section component ────────────────────────────────────────────────────────

function PnlSection({
  title,
  color,
  items,
  total,
  currencyCode,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string
  color: string
  items: LineItem[]
  total: number
  currencyCode: string
  onAdd: () => void
  onEdit: (item: PnlItem) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-[10px] font-bold tracking-widest text-white uppercase mt-4 mb-1 ${color}`}
      >
        <span className="flex items-center gap-1.5">
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {title}
        </span>
        <span className="tabular-nums font-semibold text-[11px]">{fmtCcy(total, currencyCode)}</span>
      </button>

      {expanded && (
        <div className="flex flex-col">
          {items.length === 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-sm text-muted-foreground pl-4">No items</span>
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-border/40 group">
              <div className="flex-1 min-w-0 pl-4">
                <span className="text-sm">{item.label}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {item.source === "transaction" && "Transaction"}
                  {item.source === "period" && "Fund period"}
                  {item.source === "fee" && "Fund fee"}
                  {item.source === "liability" && "Liability"}
                  {item.source === "manual" && "Manual"}
                  {item.sourceLabel ? ` · ${item.sourceLabel}` : ""}
                  {item.date ? ` · ${fmtDate(item.date)}` : ""}
                </span>
              </div>
              <span className="text-sm tabular-nums font-medium shrink-0">
                {fmtCcy(item.amount, currencyCode)}
              </span>
              {item.source === "manual" && item.manualItem && (
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(item.manualItem!)}
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 py-1.5 pl-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="size-3" />
            Add item
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Subtotal row ─────────────────────────────────────────────────────────────

function SubtotalRow({ label, value, currencyCode, highlight = false }: { label: string; value: number; currencyCode: string; highlight?: boolean }) {
  const positive = value >= 0
  return (
    <div className={`flex items-center justify-between py-2 border-t mt-1 ${highlight ? "border-t-2 border-foreground/20" : ""}`}>
      <span className={`text-sm font-semibold ${highlight ? "text-base" : ""}`}>{label}</span>
      <span className={`text-sm tabular-nums font-bold ${highlight ? "text-base" : ""} ${value === 0 ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-red-600"}`}>
        {fmtCcy(value, currencyCode)}
      </span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FundPnlClient({
  entityUUID,
  currencyCode = "EUR",
}: {
  entityUUID: string
  currencyCode?: string
}) {
  const [periods, setPeriods] = React.useState<FundPeriod[]>([])
  const [transactions, setTransactions] = React.useState<EntityTransaction[]>([])
  const [liabilities, setLiabilities] = React.useState<Liability[]>([])
  const [manualItems, setManualItems] = React.useState<PnlItem[]>([])
  const [fundFees, setFundFees] = React.useState<FundFee[]>([])
  const [loading, setLoading] = React.useState(true)

  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | "all">("all")
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [addDefaultCategory, setAddDefaultCategory] = React.useState<PnlCategory>("gross_revenue")
  const [editItem, setEditItem] = React.useState<PnlItem | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, txs, liabs, itemsRes, feesRes] = await Promise.all([
        fetch(`/api/fund-periods?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
        fetchEntityTransactions(entityUUID).catch(() => []),
        fetchEntityLiabilities(entityUUID).catch(() => []),
        fetch(`/api/pnl-items?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/fund-fees?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
      ])
      const sorted = [...(Array.isArray(pRes) ? pRes : [])].sort(
        (a: FundPeriod, b: FundPeriod) => (a.opened_at ?? 0) - (b.opened_at ?? 0)
      )
      setPeriods(sorted)
      setTransactions(Array.isArray(txs) ? txs : [])
      setLiabilities(Array.isArray(liabs) ? liabs : [])
      setManualItems(Array.isArray(itemsRes) ? itemsRes : [])
      setFundFees(Array.isArray(feesRes) ? feesRes : [])
    } finally {
      setLoading(false)
    }
  }, [entityUUID])

  React.useEffect(() => { void load() }, [load])

  const closedPeriods = periods.filter((p) => p.status === "closed")

  const selectedPeriod = selectedPeriodId === "all" ? null : closedPeriods.find((p) => p.id === selectedPeriodId) ?? null
  const fromMs = selectedPeriod?.opened_at ?? null
  const toMs = selectedPeriod?.closed_at ?? null

  // ── Build P&L data ──────────────────────────────────────────────────────────

  const pnl = React.useMemo<PnlData>(() => {
    const data: PnlData = {
      grossRevenue: [],
      cogs: [],
      operatingExpenses: [],
      interestIncome: [],
      interestExpense: [],
    }

    // 1. Transactions → categorize by entry type
    for (const tx of transactions) {
      if (!txDateInRange(tx, fromMs, toMs)) continue
      for (const leg of tx.legs) {
        const cat = categorizeLeg(leg)
        if (!cat || leg.amount <= 0) continue
        const item: LineItem = {
          id: `tx-${leg.id}`,
          label: leg.assetName || leg.objectName || leg.entryTypeLabel || leg.entryType,
          amount: leg.amount,
          source: "transaction",
          sourceLabel: tx.typeName,
          date: tx.date,
        }
        if (cat === "gross_revenue") data.grossRevenue.push(item)
        else if (cat === "cogs") data.cogs.push(item)
        else if (cat === "operating_expense") data.operatingExpenses.push(item)
        else if (cat === "interest_income") data.interestIncome.push(item)
        else if (cat === "interest_expense") data.interestExpense.push(item)
      }
    }

    // 2. Fund fees → Operating Expenses (per investor from fund_fee records)
    const periodsInRange = selectedPeriodId === "all"
      ? closedPeriods
      : closedPeriods.filter((p) => p.id === selectedPeriodId)
    const periodIdsInRange = new Set(periodsInRange.map((p) => p.id))

    const feesInRange = selectedPeriodId === "all"
      ? fundFees
      : fundFees.filter((f) => f.period && periodIdsInRange.has(f.period))

    for (const fee of feesInRange) {
      const amount = fee.amount ?? 0
      if (amount <= 0) continue
      const investorName = fee._cap_table_entry?._shareholder?.name ?? "Investor"
      const feeType = fee._share_class_fee?.type ?? "management"
      const periodName = fee._period?.label ?? null
      data.operatingExpenses.push({
        id: `fee-${fee.id}`,
        label: `${feeType.charAt(0).toUpperCase() + feeType.slice(1)} fee — ${investorName}`,
        amount,
        source: "fee",
        sourceLabel: periodName ?? undefined,
        date: fee.accrued_at,
      })
    }

    // 3. Liabilities → Interest Expense (prorated)
    for (const l of liabilities) {
      const rangeFrom = fromMs ?? (closedPeriods[0]?.opened_at ?? Date.now() - 365 * 24 * 3600 * 1000)
      const rangeTo = toMs ?? (closedPeriods[closedPeriods.length - 1]?.closed_at ?? Date.now())
      const interest = liabilityInterestForRange(l, rangeFrom, rangeTo)
      if (interest > 0.01) {
        data.interestExpense.push({
          id: `liab-${l.id}`,
          label: l.name ?? "Liability interest",
          amount: Math.round(interest * 100) / 100,
          source: "liability",
          sourceLabel: l.interest_rate ? `${l.interest_rate}% p.a.` : undefined,
        })
      }
    }

    // 4. Manual items
    for (const item of manualItems) {
      if (item.date && fromMs && toMs) {
        if (item.date < fromMs || item.date > toMs) continue
      }
      const lineItem: LineItem = {
        id: `manual-${item.id}`,
        label: item.label,
        amount: item.amount,
        source: "manual",
        date: item.date,
        manualItem: item,
      }
      if (item.category === "gross_revenue") data.grossRevenue.push(lineItem)
      else if (item.category === "cogs") data.cogs.push(lineItem)
      else if (item.category === "operating_expense") data.operatingExpenses.push(lineItem)
      else if (item.category === "interest_income") data.interestIncome.push(lineItem)
      else if (item.category === "interest_expense") data.interestExpense.push(lineItem)
    }

    return data
  }, [transactions, liabilities, manualItems, fundFees, closedPeriods, selectedPeriodId, fromMs, toMs])

  // ── Computed totals ─────────────────────────────────────────────────────────
  const totalRevenue = sum(pnl.grossRevenue)
  const totalCogs = sum(pnl.cogs)
  const grossProfit = totalRevenue - totalCogs
  const totalOpEx = sum(pnl.operatingExpenses)
  const operatingIncome = grossProfit - totalOpEx
  const totalInterestIncome = sum(pnl.interestIncome)
  const totalInterestExpense = sum(pnl.interestExpense)
  const netFinancial = totalInterestIncome - totalInterestExpense
  const netIncome = operatingIncome + netFinancial

  async function deleteManualItem(itemId: string) {
    const raw = itemId.replace("manual-", "")
    await fetch(`/api/pnl-items/${raw}`, { method: "DELETE" })
    void load()
  }

  function openAdd(cat: PnlCategory) {
    setAddDefaultCategory(cat)
    setEditItem(null)
    setAddDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (closedPeriods.length === 0 && manualItems.length === 0) {
    return (
      <div className="p-6 md:p-8 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Loss</h1>
          <p className="text-sm text-muted-foreground mt-1">Close a period in the NAV Manager to start generating your P&amp;L.</p>
        </div>
        <div className="rounded-xl border border-dashed p-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <BarChart3 className="size-8 opacity-40" />
          <p className="text-sm">P&amp;L statement will appear here once periods are closed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Loss</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {closedPeriods.length} closed period{closedPeriods.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {closedPeriods.map((p, i) => (
                <SelectItem key={p.id} value={p.id}>{periodLabel(p, i)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => openAdd("gross_revenue")} className="gap-1.5">
            <Plus className="size-3.5" />
            Add item
          </Button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Gross Revenue", value: totalRevenue, sub: `${pnl.grossRevenue.length} item${pnl.grossRevenue.length !== 1 ? "s" : ""}` },
          { label: "Gross Profit", value: grossProfit, sub: `After COGS of ${fmtCcy(totalCogs, currencyCode)}` },
          { label: "Operating Income", value: operatingIncome, sub: `${fmtCcy(totalOpEx, currencyCode)} operating expenses` },
          { label: "Net Income", value: netIncome, sub: `${fmtCcy(netFinancial, currencyCode)} net financial`, highlight: true },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className={`rounded-xl border p-4 flex flex-col gap-1 ${highlight ? "bg-foreground text-background" : "bg-card"}`}>
            <p className={`text-xs ${highlight ? "text-background/70" : "text-muted-foreground"}`}>{label}</p>
            <p className={`text-xl font-semibold tabular-nums ${highlight ? "" : value >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmtCcy(value, currencyCode)}
            </p>
            <p className={`text-xs ${highlight ? "text-background/60" : "text-muted-foreground"}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── P&L Statement ── */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Profit &amp; Loss Statement</p>
            {selectedPeriod && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtDate(selectedPeriod.opened_at)}{selectedPeriod.closed_at ? ` → ${fmtDate(selectedPeriod.closed_at)}` : ""}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-populated from transactions, period data &amp; liabilities
          </p>
        </div>

        <div className="px-5 py-4">

          {/* GROSS REVENUE */}
          <PnlSection
            title="Gross Revenue"
            color="bg-emerald-700"
            items={pnl.grossRevenue}
            total={totalRevenue}
            currencyCode={currencyCode}
            onAdd={() => openAdd("gross_revenue")}
            onEdit={(item) => { setEditItem(item); setAddDialogOpen(true) }}
            onDelete={deleteManualItem}
          />

          {/* COGS */}
          <PnlSection
            title="Cost of Income (COGS)"
            color="bg-orange-700"
            items={pnl.cogs}
            total={totalCogs}
            currencyCode={currencyCode}
            onAdd={() => openAdd("cogs")}
            onEdit={(item) => { setEditItem(item); setAddDialogOpen(true) }}
            onDelete={deleteManualItem}
          />

          {/* GROSS PROFIT */}
          <SubtotalRow label="Gross Profit" value={grossProfit} currencyCode={currencyCode} />

          {/* OPERATING EXPENSES */}
          <PnlSection
            title="Operating Expenses"
            color="bg-red-700"
            items={pnl.operatingExpenses}
            total={totalOpEx}
            currencyCode={currencyCode}
            onAdd={() => openAdd("operating_expense")}
            onEdit={(item) => { setEditItem(item); setAddDialogOpen(true) }}
            onDelete={deleteManualItem}
          />

          {/* OPERATING INCOME */}
          <SubtotalRow label="Operating Income" value={operatingIncome} currencyCode={currencyCode} />

          {/* FINANCIAL INCOME */}
          <PnlSection
            title="Interest Income"
            color="bg-blue-600"
            items={pnl.interestIncome}
            total={totalInterestIncome}
            currencyCode={currencyCode}
            onAdd={() => openAdd("interest_income")}
            onEdit={(item) => { setEditItem(item); setAddDialogOpen(true) }}
            onDelete={deleteManualItem}
          />

          {/* FINANCIAL EXPENSE */}
          <PnlSection
            title="Interest Expense"
            color="bg-blue-900"
            items={pnl.interestExpense}
            total={totalInterestExpense}
            currencyCode={currencyCode}
            onAdd={() => openAdd("interest_expense")}
            onEdit={(item) => { setEditItem(item); setAddDialogOpen(true) }}
            onDelete={deleteManualItem}
          />

          {/* NET INCOME */}
          <SubtotalRow label="Net Income" value={netIncome} currencyCode={currencyCode} highlight />

        </div>
      </div>

      <AddPnlItemDialog
        open={addDialogOpen}
        onClose={() => { setAddDialogOpen(false); setEditItem(null) }}
        entityId={entityUUID}
        defaultCategory={addDefaultCategory}
        existingItem={editItem}
        onSaved={load}
      />
    </div>
  )
}
