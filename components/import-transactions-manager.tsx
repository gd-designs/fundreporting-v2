"use client"

import * as React from "react"
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Plus,
  Paperclip,
} from "lucide-react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePickerInput } from "@/components/date-input"
import { Spinner } from "@/components/ui/spinner"
import { AddAssetDialog } from "@/components/add-asset-dialog"
import type { Currency, AssetClass } from "@/lib/types"

// ─── Domain types ─────────────────────────────────────────────────────────

type Fund = { id: string; entity: string; name: string }
type Asset = { id: string; name: string; entity: string; currencyCode: string; investable?: string | null }
type TxType = { id: number; name: string }

type CounterpartyType = "cap" | "asset" | "liability"

type Counterparty = {
  type: CounterpartyType
  id: string
  name: string
  subLabel?: string
}

// Transaction entry — the child rows (legs of a transaction)
type ParsedEntry = {
  key: number
  entryType: string // cash / asset / equity / principal / fee / etc.
  direction: "" | "in" | "out"
  amount: number
  fundId: string // empty falls back to globalFundId
  objectId: string // the asset the money moved on (usually the fund's cash asset)
  sourceType: "" | CounterpartyType
  sourceId: string
}

// Parent transaction row
type ParsedTransaction = {
  key: number
  date: string
  parsedDate: Date | undefined
  reference: string
  notes: string
  txTypeId: string // empty falls back to globalTxTypeId
  counterpartyType: "" | CounterpartyType
  counterpartyId: string
  entries: ParsedEntry[]
  pendingDocuments: File[]
  importStatus: "pending" | "importing" | "done" | "error"
  importError?: string
  raw: string[]
}

// ─── Raw grid parsing (no header assumption) ─────────────────────────────

function gridFromCsv(text: string): string[][] {
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false })
  return parsed.data.map((row) => row.map((cell) => String(cell ?? "")))
}

function gridFromXlsx(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" })
  return raw.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []))
}

// ─── Mapping returned by the AI analyzer ──────────────────────────────────

type AIMapping = {
  headerRowIndex: number
  dataStartIndex: number
  detectedBank: string
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY" | "DD.MM.YYYY" | "auto"
  currency: string | null
  columnMapping: {
    date: number | null
    reference: number | null
    amount: number | null
    credit: number | null
    debit: number | null
    balance: number | null
    direction: number | null
    senderCounterparty: number | null
  }
  skipRowPatterns: string[]
  notes: string | null
}

function parseDateWithFormat(raw: string, format: AIMapping["dateFormat"]): Date | undefined {
  if (!raw?.trim()) return undefined
  const s = raw.trim()
  if (format === "YYYY-MM-DD") {
    const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  if (format === "DD/MM/YYYY" || format === "DD-MM-YYYY" || format === "DD.MM.YYYY") {
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
    if (m) {
      const yyyy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
      return new Date(yyyy, Number(m[2]) - 1, Number(m[1]))
    }
  }
  if (format === "MM/DD/YYYY" || format === "MM-DD-YYYY") {
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
    if (m) {
      const yyyy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
      return new Date(yyyy, Number(m[1]) - 1, Number(m[2]))
    }
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

function parseAmount(raw: string): number {
  if (!raw) return 0
  let cleaned = raw.replace(/[€$£¥]/g, "").replace(/\s/g, "").trim()
  if (!cleaned) return 0
  let negative = false
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    negative = true
    cleaned = cleaned.slice(1, -1)
  }
  if (cleaned.startsWith("-")) {
    negative = true
    cleaned = cleaned.slice(1)
  }
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".")
    } else {
      cleaned = cleaned.replace(/,/g, "")
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",")
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(",", ".")
    } else {
      cleaned = cleaned.replace(/,/g, "")
    }
  }
  const n = parseFloat(cleaned)
  if (isNaN(n)) return 0
  return Math.abs(n) * (negative ? -1 : 1)
}

function rowMatchesSkipPattern(row: string[], patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const text = row.join(" ").toLowerCase()
  return patterns.some((p) => text.includes(p.toLowerCase()))
}

// Turn the raw grid into ParsedTransactions. Each CSV line becomes one
// transaction with a single cash entry (direction + amount). The user then
// selects fund / cash asset / source and can add more entries if needed.
function mapGridWithAI(grid: string[][], mapping: AIMapping, startKey: number): ParsedTransaction[] {
  const out: ParsedTransaction[] = []
  let key = startKey
  let entryKey = 1
  const cm = mapping.columnMapping

  for (let i = mapping.dataStartIndex; i < grid.length; i++) {
    const row = grid[i]
    if (!row || row.every((c) => !c?.trim())) continue
    if (rowMatchesSkipPattern(row, mapping.skipRowPatterns)) continue

    const get = (idx: number | null) => (idx != null && idx < row.length ? String(row[idx] ?? "").trim() : "")

    const dateStr = get(cm.date)
    const reference = get(cm.reference) || get(cm.senderCounterparty)

    let amount = 0
    let direction: "" | "in" | "out" = ""

    if (cm.amount != null) {
      const signed = parseAmount(get(cm.amount))
      amount = Math.abs(signed)
      direction = signed >= 0 ? "in" : "out"
      const dir = get(cm.direction).toLowerCase()
      if (dir) {
        if (["in", "cr", "credit", "+"].some((t) => dir.includes(t))) direction = "in"
        else if (["out", "dr", "debit", "-"].some((t) => dir.includes(t))) direction = "out"
      }
    } else {
      const credit = parseAmount(get(cm.credit))
      const debit = parseAmount(get(cm.debit))
      if (credit > 0) { amount = credit; direction = "in" }
      else if (debit > 0) { amount = debit; direction = "out" }
    }
    if (amount <= 0) continue

    out.push({
      key: key++,
      date: dateStr,
      reference,
      notes: "",
      txTypeId: "",
      parsedDate: parseDateWithFormat(dateStr, mapping.dateFormat),
      counterpartyType: "",
      counterpartyId: "",
      entries: [
        {
          key: entryKey++,
          entryType: "cash",
          direction,
          amount,
          fundId: "",
          objectId: "",
          sourceType: "",
          sourceId: "",
        },
      ],
      pendingDocuments: [],
      importStatus: "pending",
      raw: row,
    })
  }
  return out
}

// ─── Component ────────────────────────────────────────────────────────────

export function ImportTransactionsManager({ assetManagerId }: { assetManagerId: string }) {
  const [funds, setFunds] = React.useState<Fund[]>([])
  const [assetsByFund, setAssetsByFund] = React.useState<Map<string, Asset[]>>(new Map())
  const [counterpartiesByFund, setCounterpartiesByFund] = React.useState<Map<string, Counterparty[]>>(new Map())
  const [txTypes, setTxTypes] = React.useState<TxType[]>([])
  const [currencies, setCurrencies] = React.useState<Currency[]>([])
  const [assetClasses, setAssetClasses] = React.useState<AssetClass[]>([])
  const [transactions, setTransactions] = React.useState<ParsedTransaction[]>([])
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set())
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null)
  const [aiMapping, setAiMapping] = React.useState<AIMapping | null>(null)

  // Global defaults (top bar)
  const [globalFundId, setGlobalFundId] = React.useState("")
  const [globalCashAssetId, setGlobalCashAssetId] = React.useState("")
  const [globalTxTypeId, setGlobalTxTypeId] = React.useState("")

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const nextKey = React.useRef(1)
  const nextEntryKey = React.useRef(1)

  React.useEffect(() => {
    fetch(`/api/funds?managed_by=${assetManagerId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ id: string; entity?: string; name?: string }>) => {
        setFunds(list.filter((f) => f.entity).map((f) => ({ id: f.id, entity: f.entity!, name: f.name ?? f.id })))
      })
      .catch(() => setFunds([]))
    fetch("/api/transaction-types")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ id: number; name?: string }>) => {
        setTxTypes(list.filter((t) => t.name).map((t) => ({ id: t.id, name: t.name! })))
      })
      .catch(() => setTxTypes([]))
    fetch("/api/currencies")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCurrencies)
      .catch(() => setCurrencies([]))
    fetch("/api/asset-classes")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ id: number; name?: string }>) => {
        setAssetClasses(list.filter((c) => c.name).map((c) => ({ id: c.id, name: c.name! })))
      })
      .catch(() => setAssetClasses([]))
  }, [assetManagerId])

  async function loadFundData(fundEntity: string, force = false) {
    if (!force && assetsByFund.has(fundEntity) && counterpartiesByFund.has(fundEntity)) return
    const [assetsRes, liabilitiesRes, shareholdersRes] = await Promise.all([
      fetch(`/api/assets?entity=${fundEntity}`),
      fetch(`/api/liabilities?entity=${fundEntity}`),
      fetch(`/api/cap-table-shareholders?entity=${fundEntity}`),
    ])
    const assetList: Array<{
      id: string
      name?: string
      entity?: string
      asset_class?: number | null
      investable?: string | null
      _currency?: { code?: string }
    }> = assetsRes.ok ? await assetsRes.json() : []
    const liabilityList: Array<{ id: string; name?: string; reference?: string }> =
      liabilitiesRes.ok ? await liabilitiesRes.json() : []
    const shareholderList: Array<{ id: string; name?: string; email?: string | null; type?: string | null }> =
      shareholdersRes.ok ? await shareholdersRes.json() : []

    const mappedAssets: Asset[] = assetList.map((a) => ({
      id: a.id,
      name: a.name ?? a.id.slice(0, 8),
      entity: a.entity ?? fundEntity,
      currencyCode: a._currency?.code ?? "",
      investable: a.investable ?? null,
    }))

    const counterparties: Counterparty[] = [
      ...shareholderList.map((s) => ({
        type: "cap" as const,
        id: s.id,
        name: s.name ?? "Investor",
        subLabel: s.email ?? s.type ?? undefined,
      })),
      ...assetList.map((a) => ({
        type: "asset" as const,
        id: a.id,
        name: a.name ?? "Asset",
        subLabel: a._currency?.code,
      })),
      ...liabilityList.map((l) => ({
        type: "liability" as const,
        id: l.id,
        name: l.name ?? l.reference ?? "Liability",
      })),
    ]

    setAssetsByFund((prev) => new Map(prev).set(fundEntity, mappedAssets))
    setCounterpartiesByFund((prev) => new Map(prev).set(fundEntity, counterparties))
  }

  // Load fund data when global fund changes
  React.useEffect(() => {
    if (!globalFundId) return
    const fund = funds.find((f) => f.id === globalFundId)
    if (fund) void loadFundData(fund.entity)
  }, [globalFundId, funds]) // eslint-disable-line react-hooks/exhaustive-deps

  function effectiveFundId(entry: ParsedEntry) {
    return entry.fundId || globalFundId
  }
  function effectiveObjectId(entry: ParsedEntry) {
    return entry.objectId || globalCashAssetId
  }
  function effectiveTxTypeId(tx: ParsedTransaction) {
    return tx.txTypeId || globalTxTypeId
  }

  function applyGlobalsToAllRows() {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        txTypeId: t.txTypeId || globalTxTypeId,
        entries: t.entries.map((e) => ({
          ...e,
          fundId: e.fundId || globalFundId,
          objectId: e.objectId || globalCashAssetId,
        })),
      })),
    )
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    setFileName(file.name)
    setAnalyzeError(null)
    setAiMapping(null)

    let grid: string[][] = []
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text()
        grid = gridFromCsv(text)
      } else {
        const buffer = await file.arrayBuffer()
        grid = gridFromXlsx(buffer)
      }
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Failed to parse file")
      return
    }
    if (grid.length === 0) {
      setAnalyzeError("File is empty")
      return
    }

    setAnalyzing(true)
    try {
      const sample = grid.slice(0, 40)
      const res = await fetch("/api/import-transactions-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: sample, fileName: file.name }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Analysis failed")
      }
      const { mapping } = (await res.json()) as { mapping: AIMapping }
      setAiMapping(mapping)

      const mapped = mapGridWithAI(grid, mapping, nextKey.current)
      nextKey.current += mapped.length
      nextEntryKey.current += mapped.reduce((s, t) => s + t.entries.length, 0)
      setTransactions(mapped)
      if (mapped.length === 0) {
        setAnalyzeError("No transaction rows found after applying the detected mapping.")
      }
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Failed to analyze file")
    } finally {
      setAnalyzing(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function updateTx(key: number, patch: Partial<ParsedTransaction>) {
    setTransactions((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  }

  function updateEntry(txKey: number, entryKey: number, patch: Partial<ParsedEntry>) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.key === txKey
          ? { ...t, entries: t.entries.map((e) => (e.key === entryKey ? { ...e, ...patch } : e)) }
          : t,
      ),
    )
  }

  function addEntry(txKey: number) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.key === txKey
          ? {
              ...t,
              entries: [
                ...t.entries,
                {
                  key: nextEntryKey.current++,
                  entryType: "cash",
                  direction: "",
                  amount: 0,
                  fundId: "",
                  objectId: "",
                  sourceType: "",
                  sourceId: "",
                },
              ],
            }
          : t,
      ),
    )
    setExpanded((s) => new Set(s).add(txKey))
  }

  function removeEntry(txKey: number, entryKey: number) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.key === txKey ? { ...t, entries: t.entries.filter((e) => e.key !== entryKey) } : t,
      ),
    )
  }

  function removeTx(key: number) {
    setTransactions((prev) => prev.filter((t) => t.key !== key))
  }

  // ─── Entry template engine ───────────────────────────────────────────────
  // Given (tx type + counter-party), return a set of entries that matches the
  // accounting shape required. Returns null when no template exists → caller
  // preserves whatever entries are already on the transaction.

  type TemplateCtx = {
    txTypeName: string // lowercased
    counterpartyType: CounterpartyType
    counterpartyId: string
    amount: number
    direction: "in" | "out" | ""
    cashAssetId: string
    fundId: string
  }

  function buildEntriesFromTemplate(ctx: TemplateCtx): Array<Omit<ParsedEntry, "key">> | null {
    const base = { amount: ctx.amount, fundId: ctx.fundId }

    // Income into an asset owned by the fund (e.g. rental income on a property):
    //  1. Income IN on the counter-party asset
    //  2. Asset OUT of the counter-party, bound for cash
    //  3. Cash IN on the fund's cash asset, from the counter-party
    if (ctx.txTypeName === "income" && ctx.counterpartyType === "asset") {
      return [
        { ...base, entryType: "income", direction: "in",  objectId: ctx.counterpartyId, sourceType: "",      sourceId: "" },
        { ...base, entryType: "asset",  direction: "out", objectId: ctx.counterpartyId, sourceType: "asset", sourceId: ctx.cashAssetId },
        { ...base, entryType: "cash",   direction: "in",  objectId: ctx.cashAssetId,    sourceType: "asset", sourceId: ctx.counterpartyId },
      ]
    }

    // No template — caller keeps existing entries
    return null
  }

  function regenerateEntries(tx: ParsedTransaction): ParsedEntry[] {
    const txType = txTypes.find((t) => String(t.id) === effectiveTxTypeId(tx))
    const txTypeName = (txType?.name ?? "").toLowerCase()
    const cashAssetId = globalCashAssetId || tx.entries[0]?.objectId || ""
    const fundId = globalFundId || tx.entries[0]?.fundId || ""
    const amount = tx.entries[0]?.amount ?? 0
    const direction = tx.entries[0]?.direction ?? ""

    if (!tx.counterpartyType || !tx.counterpartyId) return tx.entries

    const template = buildEntriesFromTemplate({
      txTypeName,
      counterpartyType: tx.counterpartyType,
      counterpartyId: tx.counterpartyId,
      amount,
      direction,
      cashAssetId,
      fundId,
    })

    if (!template) return tx.entries

    return template.map((e) => ({ ...e, key: nextEntryKey.current++ }))
  }


  function addDocumentsToTx(txKey: number, files: FileList | null) {
    if (!files || files.length === 0) return
    const added = Array.from(files)
    setTransactions((prev) =>
      prev.map((t) =>
        t.key === txKey ? { ...t, pendingDocuments: [...t.pendingDocuments, ...added] } : t,
      ),
    )
    // Auto-expand so the user sees their attachment
    setExpanded((s) => new Set(s).add(txKey))
  }

  function removeDocumentFromTx(txKey: number, index: number) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.key === txKey
          ? { ...t, pendingDocuments: t.pendingDocuments.filter((_, i) => i !== index) }
          : t,
      ),
    )
  }

  function toggleExpanded(key: number) {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearAll() {
    setTransactions([])
    setFileName(null)
    setAiMapping(null)
    setAnalyzeError(null)
    setExpanded(new Set())
  }

  function isTxReady(tx: ParsedTransaction): boolean {
    if (!effectiveTxTypeId(tx)) return false
    if (!tx.parsedDate) return false
    if (tx.entries.length === 0) return false
    return tx.entries.every(
      (e) =>
        e.direction &&
        e.amount > 0 &&
        effectiveFundId(e) &&
        effectiveObjectId(e) &&
        e.sourceType &&
        e.sourceId,
    )
  }

  const readyCount = transactions.filter((t) => t.importStatus === "pending" && isTxReady(t)).length

  async function importAll() {
    setImporting(true)

    // Resolve asset manager entity UUID for created_by_entity
    const amEntityUUID = await (async () => {
      const res = await fetch(`/api/asset-managers/${assetManagerId}`).catch(() => null)
      if (!res?.ok) return null
      const am = (await res.json()) as { entity?: string | null }
      return typeof am.entity === "string" ? am.entity : null
    })()

    for (const tx of transactions) {
      if (tx.importStatus !== "pending" || !isTxReady(tx)) continue
      updateTx(tx.key, { importStatus: "importing" })
      try {
        const txTypeIdNum = Number(effectiveTxTypeId(tx))
        const firstEntry = tx.entries[0]
        const firstFund = funds.find((f) => f.id === effectiveFundId(firstEntry))

        const txRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            created_by_entity: amEntityUUID ?? firstFund?.entity,
            type: txTypeIdNum,
            date: tx.parsedDate!.getTime(),
            ...(tx.reference.trim() ? { reference: tx.reference.trim() } : {}),
            ...(tx.notes.trim() ? { notes: tx.notes.trim() } : {}),
          }),
        })
        if (!txRes.ok) throw new Error("Failed to create transaction")
        const created = (await txRes.json()) as { id: string }

        for (const entry of tx.entries) {
          const fund = funds.find((f) => f.id === effectiveFundId(entry))
          if (!fund) throw new Error("Fund not found for entry")
          await fetch("/api/transaction-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transaction: created.id,
              entity: fund.entity,
              entry_type: entry.entryType || "cash",
              object_type: "asset",
              object_id: effectiveObjectId(entry),
              direction: entry.direction,
              amount: entry.amount,
              source: entry.sourceType,
              source_id: entry.sourceId,
            }),
          })
        }

        // Upload any pending documents — attach to the fund entity (first entry's fund)
        if (tx.pendingDocuments.length > 0 && firstFund?.entity) {
          const form = new FormData()
          form.set("entity", firstFund.entity)
          form.set("object_type", "transaction")
          form.set("object_id", created.id)
          for (const file of tx.pendingDocuments) form.append("files", file)
          await fetch("/api/documents", { method: "POST", body: form }).catch(() => {
            // non-fatal: transaction + entries are already saved
            console.warn("[import] document upload failed for tx", created.id)
          })
        }

        updateTx(tx.key, { importStatus: "done" })
      } catch (e) {
        updateTx(tx.key, {
          importStatus: "error",
          importError: e instanceof Error ? e.message : "Import failed",
        })
      }
    }
    setImporting(false)
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {transactions.length === 0 && !analyzing ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-foreground bg-muted/50"
              : "border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-muted/20"
          }`}
        >
          <FileSpreadsheet className="size-10 mx-auto mb-3 text-muted-foreground/60" />
          <p className="font-medium">Drop a CSV or Excel file</p>
          <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            AI will detect headers, columns, and date format — works across bank formats.
          </p>
          {analyzeError && <p className="mt-3 text-sm text-destructive">{analyzeError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      ) : analyzing ? (
        <div className="rounded-xl border p-8 flex flex-col items-center justify-center gap-3">
          <Spinner className="size-6" />
          <p className="font-medium">Analyzing {fileName}…</p>
          <p className="text-sm text-muted-foreground">
            Claude is reading the file to detect the header row and map columns.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          {/* Summary header */}
          <div className="flex items-center justify-between px-4 py-3 border-b gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">
                · {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
              </span>
              {readyCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
                  {readyCount} ready
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearAll} disabled={importing}>
                Clear
              </Button>
              <Button size="sm" disabled={importing || readyCount === 0} onClick={importAll}>
                {importing ? (
                  <>
                    <Spinner className="size-3.5 mr-1.5" />
                    Importing…
                  </>
                ) : (
                  `Import ${readyCount} transaction${readyCount !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>

          {/* AI banner */}
          {aiMapping && (
            <div className="px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <Sparkles className="size-3 text-blue-600" />
              <span className="font-medium text-foreground">{aiMapping.detectedBank}</span>
              <span>·</span>
              <span>Headers at row {aiMapping.headerRowIndex + 1}</span>
              <span>·</span>
              <span>Dates: {aiMapping.dateFormat}</span>
              {aiMapping.currency && (
                <>
                  <span>·</span>
                  <span>Currency: {aiMapping.currency}</span>
                </>
              )}
              {aiMapping.skipRowPatterns.length > 0 && (
                <>
                  <span>·</span>
                  <span>Skipped: {aiMapping.skipRowPatterns.join(", ")}</span>
                </>
              )}
            </div>
          )}

          {/* Global defaults */}
          <div className="px-4 py-3 border-b bg-muted/10">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span className="font-medium uppercase tracking-wide text-[11px]">Defaults for all rows</span>
              <span className="italic">— individual rows can still override</span>
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="grid gap-1 flex-1 min-w-[200px]">
                <Label className="text-[11px] text-muted-foreground">Fund</Label>
                <Select
                  value={globalFundId}
                  onValueChange={(v) => {
                    setGlobalFundId(v)
                    setGlobalCashAssetId("")
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select fund…" />
                  </SelectTrigger>
                  <SelectContent>
                    {funds.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1 flex-1 min-w-[200px]">
                <Label className="text-[11px] text-muted-foreground">Cash asset</Label>
                <Select
                  value={globalCashAssetId}
                  onValueChange={setGlobalCashAssetId}
                  disabled={!globalFundId}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select cash asset…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const gf = funds.find((f) => f.id === globalFundId)
                      const fa = gf ? assetsByFund.get(gf.entity) ?? [] : []
                      return fa.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          {a.currencyCode ? ` (${a.currencyCode})` : ""}
                        </SelectItem>
                      ))
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1 flex-1 min-w-[180px]">
                <Label className="text-[11px] text-muted-foreground">Transaction type</Label>
                <Select value={globalTxTypeId} onValueChange={setGlobalTxTypeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {txTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={applyGlobalsToAllRows}
                disabled={!globalFundId && !globalCashAssetId && !globalTxTypeId}
              >
                Apply to all rows
              </Button>
            </div>
          </div>

          {/* Transactions list */}
          <div className="divide-y">
            {/* Parent table header — column widths must mirror the parent row below */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              <span className="size-4 shrink-0" />
              <span className="w-16 shrink-0">Status</span>
              <span className="w-44 shrink-0">Date</span>
              <span className="flex-1 min-w-0">Reference</span>
              <span className="w-28 text-right shrink-0">Amount</span>
              <span className="w-32 shrink-0">CP type</span>
              <span className="w-44 shrink-0">Counter-party</span>
              <span className="w-40 shrink-0">Tx type</span>
              <span className="size-3.5 shrink-0" />
              <span className="size-3.5 shrink-0" />
            </div>

            {transactions.map((tx) => {
              const ready = isTxReady(tx)
              const isOpen = expanded.has(tx.key)
              // Transaction amount — entries are double-entry legs that balance each
              // other, so the transaction "amount" is just the size (any one leg).
              const txAmount = tx.entries[0]?.amount ?? 0

              // Counter-party options for the parent row come from the fund the
              // first entry (or the global default) points at.
              const parentFundId = tx.entries[0]?.fundId || globalFundId
              const parentFund = funds.find((f) => f.id === parentFundId)
              const parentCps = parentFund ? counterpartiesByFund.get(parentFund.entity) ?? [] : []
              const parentCpOptions = tx.counterpartyType
                ? parentCps.filter((c) => c.type === tx.counterpartyType)
                : parentCps
              return (
                <div key={tx.key}>
                  {/* Parent row */}
                  <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(tx.key)}
                      className="text-muted-foreground shrink-0"
                    >
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>

                    {/* Status pill */}
                    <div className="w-16 shrink-0 text-xs">
                      {tx.importStatus === "done" ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : tx.importStatus === "importing" ? (
                        <Spinner className="size-4" />
                      ) : tx.importStatus === "error" ? (
                        <span title={tx.importError}>
                          <AlertCircle className="size-4 text-red-500" />
                        </span>
                      ) : ready ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-medium">
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
                          Map
                        </span>
                      )}
                    </div>

                    <div className="w-44 shrink-0">
                      <DatePickerInput
                        id={`tx-${tx.key}-date`}
                        label=""
                        value={tx.parsedDate}
                        onChange={(d) => updateTx(tx.key, { parsedDate: d })}
                      />
                    </div>

                    <Input
                      className="h-8 text-xs flex-1 min-w-0"
                      placeholder="Reference"
                      value={tx.reference}
                      onChange={(e) => updateTx(tx.key, { reference: e.target.value })}
                    />

                    <span className="text-sm tabular-nums font-medium w-28 text-right shrink-0">
                      {txAmount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>

                    <div className="w-32 shrink-0">
                      <Select
                        value={tx.counterpartyType || undefined}
                        onValueChange={(v) => {
                          updateTx(tx.key, { counterpartyType: v as CounterpartyType, counterpartyId: "" })
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-full min-w-0">
                          <SelectValue placeholder="CP type…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cap">Cap table</SelectItem>
                          <SelectItem value="asset">Asset</SelectItem>
                          <SelectItem value="liability">Liability</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-44 shrink-0">
                      <Select
                        value={tx.counterpartyId}
                        onValueChange={(v) => {
                          // Apply template the moment the user picks a counter-party.
                          // This is the cleanest UX — entries regenerate automatically.
                          setTransactions((prev) =>
                            prev.map((t) => {
                              if (t.key !== tx.key) return t
                              const withCp = { ...t, counterpartyId: v }
                              return { ...withCp, entries: regenerateEntries(withCp) }
                            }),
                          )
                          setExpanded((s) => new Set(s).add(tx.key))
                        }}
                        disabled={!tx.counterpartyType}
                      >
                        <SelectTrigger className="h-8 text-xs w-full min-w-0">
                          <SelectValue placeholder="Counter-party…" />
                        </SelectTrigger>
                        <SelectContent>
                          {parentCpOptions.map((c) => (
                            <SelectItem key={`${c.type}-${c.id}`} value={c.id}>
                              {c.name}
                              {c.subLabel ? ` · ${c.subLabel}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-40 shrink-0">
                      <Select
                        value={effectiveTxTypeId(tx)}
                        onValueChange={(v) => {
                          // Changing tx type re-runs the template too
                          setTransactions((prev) =>
                            prev.map((t) => {
                              if (t.key !== tx.key) return t
                              const withType = { ...t, txTypeId: v }
                              return { ...withType, entries: regenerateEntries(withType) }
                            }),
                          )
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-full min-w-0">
                          <SelectValue placeholder="Type…" />
                        </SelectTrigger>
                        <SelectContent>
                          {txTypes.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Attach documents */}
                    <label
                      className="relative text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                      title={
                        tx.pendingDocuments.length > 0
                          ? `${tx.pendingDocuments.length} file${tx.pendingDocuments.length !== 1 ? "s" : ""} attached`
                          : "Attach documents"
                      }
                    >
                      <Paperclip className="size-3.5" />
                      {tx.pendingDocuments.length > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-semibold size-3.5">
                          {tx.pendingDocuments.length}
                        </span>
                      )}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addDocumentsToTx(tx.key, e.target.files)
                          e.target.value = "" // reset to allow re-selecting same file
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeTx(tx.key)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* Expanded: notes + entries */}
                  {isOpen && (
                    <div className="bg-muted/20 border-t px-12 py-3 space-y-3">
                      {/* Notes */}
                      <div className="grid gap-1">
                        <Label className="text-[11px] text-muted-foreground">Notes</Label>
                        <textarea
                          className="border-input bg-background min-h-16 rounded-md border px-3 py-2 text-xs"
                          placeholder="Optional notes for this transaction"
                          value={tx.notes}
                          onChange={(e) => updateTx(tx.key, { notes: e.target.value })}
                        />
                      </div>

                      {/* Attached documents */}
                      {tx.pendingDocuments.length > 0 && (
                        <div className="grid gap-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Documents ({tx.pendingDocuments.length})
                          </Label>
                          <div className="rounded-md border divide-y bg-background">
                            {tx.pendingDocuments.map((file, i) => (
                              <div
                                key={`${file.name}-${i}`}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs"
                              >
                                <Paperclip className="size-3 text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate">{file.name}</span>
                                <span className="text-muted-foreground">
                                  {(file.size / 1024).toFixed(0)} KB
                                </span>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => removeDocumentFromTx(tx.key, i)}
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Uploaded and linked to this transaction on Import.
                          </p>
                        </div>
                      )}

                      {/* Entries */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Entries ({tx.entries.length})
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs gap-1"
                            onClick={() => addEntry(tx.key)}
                          >
                            <Plus className="size-3" />
                            Add entry
                          </Button>
                        </div>

                        <div className="rounded-md border divide-y bg-background">
                          {/* Entries table header */}
                          <div className="grid grid-cols-12 gap-2 p-2 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            <span className="col-span-1">Entry type</span>
                            <span className="col-span-1">Direction</span>
                            <span className="col-span-1 text-right">Amount</span>
                            <span className="col-span-2">Fund</span>
                            <span className="col-span-2">Asset</span>
                            <span className="col-span-2">Source type</span>
                            <span className="col-span-2">Source</span>
                            <span className="col-span-1" />
                          </div>

                          {tx.entries.map((entry) => {
                            const fund = funds.find((f) => f.id === effectiveFundId(entry))
                            const fundAssets = fund ? assetsByFund.get(fund.entity) ?? [] : []
                            const fundCounterparties = fund
                              ? counterpartiesByFund.get(fund.entity) ?? []
                              : []
                            const cpOptions = fundCounterparties.filter(
                              (c) => !entry.sourceType || c.type === entry.sourceType,
                            )
                            return (
                              <div key={entry.key} className="grid grid-cols-12 gap-2 p-2 items-center">
                                {/* Entry type */}
                                <div className="col-span-1">
                                  <Select
                                    value={entry.entryType}
                                    onValueChange={(v) => updateEntry(tx.key, entry.key, { entryType: v })}
                                  >
                                    <SelectTrigger className="h-7 text-[11px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="cash">Cash</SelectItem>
                                      <SelectItem value="asset">Asset</SelectItem>
                                      <SelectItem value="equity">Equity</SelectItem>
                                      <SelectItem value="fee">Fee</SelectItem>
                                      <SelectItem value="interest">Interest</SelectItem>
                                      <SelectItem value="principal">Principal</SelectItem>
                                      <SelectItem value="income">Income</SelectItem>
                                      <SelectItem value="expense">Expense</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Direction */}
                                <div className="col-span-1">
                                  <Select
                                    value={entry.direction}
                                    onValueChange={(v) =>
                                      updateEntry(tx.key, entry.key, { direction: v as "in" | "out" })
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-[11px]">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="in">In</SelectItem>
                                      <SelectItem value="out">Out</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Amount */}
                                <div className="col-span-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 text-[11px] text-right"
                                    value={entry.amount}
                                    onChange={(e) =>
                                      updateEntry(tx.key, entry.key, {
                                        amount: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </div>

                                {/* Fund */}
                                <div className="col-span-2">
                                  <Select
                                    value={effectiveFundId(entry)}
                                    onValueChange={async (v) => {
                                      updateEntry(tx.key, entry.key, {
                                        fundId: v,
                                        objectId: "",
                                        sourceId: "",
                                      })
                                      const f = funds.find((x) => x.id === v)
                                      if (f) await loadFundData(f.entity)
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-[11px]">
                                      <SelectValue placeholder="Fund…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {funds.map((f) => (
                                        <SelectItem key={f.id} value={f.id}>
                                          {f.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Asset (object_id) */}
                                <div className="col-span-2 flex items-center gap-1">
                                  <Select
                                    value={effectiveObjectId(entry)}
                                    onValueChange={(v) => updateEntry(tx.key, entry.key, { objectId: v })}
                                    disabled={!effectiveFundId(entry)}
                                  >
                                    <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
                                      <SelectValue placeholder="Asset…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {fundAssets.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                          {a.name}
                                          {a.currencyCode ? ` (${a.currencyCode})` : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {fund && (
                                    <AddAssetDialog
                                      entityUUID={fund.entity}
                                      currencies={currencies}
                                      assetClasses={assetClasses}
                                      defaultCurrencyCode={
                                        fundAssets.find((a) => a.id === effectiveObjectId(entry))?.currencyCode || undefined
                                      }
                                      onCreated={() => {
                                        void loadFundData(fund.entity, true)
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="shrink-0 size-7 inline-flex items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        title="Add new asset"
                                      >
                                        <Plus className="size-3" />
                                      </button>
                                    </AddAssetDialog>
                                  )}
                                </div>

                                {/* Source type */}
                                <div className="col-span-2">
                                  <Select
                                    value={entry.sourceType}
                                    onValueChange={(v) =>
                                      updateEntry(tx.key, entry.key, {
                                        sourceType: v as CounterpartyType,
                                        sourceId: "",
                                      })
                                    }
                                    disabled={!effectiveFundId(entry)}
                                  >
                                    <SelectTrigger className="h-7 text-[11px]">
                                      <SelectValue placeholder="Source…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="cap">Cap table</SelectItem>
                                      <SelectItem value="asset">Asset</SelectItem>
                                      <SelectItem value="liability">Liability</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Source value */}
                                <div className="col-span-2">
                                  <Select
                                    value={entry.sourceId}
                                    onValueChange={(v) => updateEntry(tx.key, entry.key, { sourceId: v })}
                                    disabled={!entry.sourceType || !effectiveFundId(entry)}
                                  >
                                    <SelectTrigger className="h-7 text-[11px]">
                                      <SelectValue placeholder="Select…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {cpOptions.map((c) => (
                                        <SelectItem key={`${c.type}-${c.id}`} value={c.id}>
                                          {c.name}
                                          {c.subLabel ? ` · ${c.subLabel}` : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="col-span-1 flex justify-end">
                                  {tx.entries.length > 1 && (
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() => removeEntry(tx.key, entry.key)}
                                    >
                                      <X className="size-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
