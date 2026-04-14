"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { notifyAssetsUpdate } from "@/lib/ledger-events"
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ArrowLeftRight,
  Banknote,
  GripVertical,
  HelpCircle,
  Paperclip,
  Pencil,
  Plus,
  SlidersHorizontal,
} from "lucide-react"
import { AddAssetDialog } from "@/components/add-asset-dialog"
import { BuySellDialog } from "@/components/buy-sell-dialog"
import { MoneyInDialog } from "@/components/money-in-dialog"
import { RevalueDialog } from "@/components/revalue-dialog"
import { DistributionDialog } from "@/components/distribution-dialog"
import { AddAssetToSheetDialog } from "@/components/add-asset-to-sheet-dialog"
import { AssetManagementSheet } from "@/components/asset-management-sheet"
import { CreateSectionDialog } from "@/components/create-section-dialog"
import { CreateSheetDialog } from "@/components/create-sheet-dialog"
import { EditSectionDialog } from "@/components/edit-section-dialog"
import { EditSheetDialog } from "@/components/edit-sheet-dialog"
import { UploadDocumentsDialog } from "@/components/upload-documents-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  fetchEntityAssets,
  formatCurrency,
  ENTITY_ASSETS_CHANGED_EVENT,
  updateEntityAsset,
  type EntityAsset,
} from "@/lib/entity-assets"
import { fetchFxRates } from "@/lib/fx"
import { fetchEntityTransactions, isCapitalTransaction, type EntityTransaction } from "@/lib/entity-transactions"
import { fetchEntityMutations, type Mutation } from "@/lib/mutations"
import { fetchDocuments } from "@/lib/documents"
import { fetchMarketQuote, fetchMarketPriceAt, LIVE_QUOTE_UPDATED_EVENT } from "@/lib/market"
import {
  createEntitySheet,
  createEntitySection,
  createEntitySheetItem,
  fetchEntitySheets,
  fetchEntitySections,
  fetchEntitySheetItems,
  updateEntitySheet,
  updateEntitySection,
  updateEntitySheetItem,
  type EntitySheet,
  type EntitySection,
  type EntitySheetItem,
} from "@/lib/entity-sheets"

const ALL_ASSETS_SHEET_ID = "__all_assets__"
const ASSET_CHANGE_RANGE_COOKIE = "asset_change_range"
const CHANGE_RANGES = [
  { id: "1d", label: "1 Day", ms: 24 * 60 * 60 * 1000 },
  { id: "1w", label: "1 Week", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "1m", label: "1 Month", ms: 30 * 24 * 60 * 60 * 1000 },
  { id: "1y", label: "1 Year", ms: 365 * 24 * 60 * 60 * 1000 },
] as const
type ChangeRangeId = (typeof CHANGE_RANGES)[number]["id"]

export function AssetsManager({ entityUUID, baseCurrency: baseCurrencyProp, allowNewMoneyIn = false, entityType }: { entityUUID: string; baseCurrency?: string; allowNewMoneyIn?: boolean; entityType?: string }) {
  const searchParams = useSearchParams()
  const [assets, setAssets] = React.useState<EntityAsset[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [transactions, setTransactions] = React.useState<EntityTransaction[]>([])
  const [assetBalances, setAssetBalances] = React.useState<Map<string, number>>(new Map())
  const [allMutations, setAllMutations] = React.useState<Mutation[]>([])
  const [docCounts, setDocCounts] = React.useState<Map<string, number>>(new Map())
  const [currencies, setCurrencies] = React.useState<Array<{ id: number; code: string; name: string }>>([])
  const [assetClasses, setAssetClasses] = React.useState<Array<{ id: number; name: string }>>([])
  const [selectedAsset, setSelectedAsset] = React.useState<EntityAsset | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheets, setSheets] = React.useState<EntitySheet[]>([])
  const [sections, setSections] = React.useState<EntitySection[]>([])
  const [sheetItems, setSheetItems] = React.useState<EntitySheetItem[]>([])
  const [activeSheetId, setActiveSheetId] = React.useState<string>(ALL_ASSETS_SHEET_ID)

  const [savingSheet, setSavingSheet] = React.useState(false)
  const [savingSection, setSavingSection] = React.useState(false)
  const [savingItem, setSavingItem] = React.useState(false)
  const [sheetError, setSheetError] = React.useState<string | null>(null)

  const [editingSheet, setEditingSheet] = React.useState<EntitySheet | null>(null)
  const [editingSection, setEditingSection] = React.useState<EntitySection | null>(null)

  const [fxRates, setFxRates] = React.useState<Record<string, number>>({})
  const [fxLoading, setFxLoading] = React.useState(false)
  const [liveQuotesByTicker, setLiveQuotesByTicker] = React.useState<
    Record<string, { price: number; asOf: number | null }>
  >({})
  const [quotesLoading, setQuotesLoading] = React.useState(false)
  const [stakeValuesByAsset, setStakeValuesByAsset] = React.useState<Map<string, number>>(new Map())
  const [nowMs, setNowMs] = React.useState(() => Date.now())

  const [dragAssetId, setDragAssetId] = React.useState<string | null>(null)
  const [dragOver, setDragOver] = React.useState<{ targetId: string; position: "above" | "below" } | null>(null)
  const [reordering, setReordering] = React.useState(false)
  const [sectionDropTargetId, setSectionDropTargetId] = React.useState<string | null>(null)
  const [dragSheetId, setDragSheetId] = React.useState<string | null>(null)
  const [dragOverSheet, setDragOverSheet] = React.useState<{ targetId: string; position: "before" | "after" } | null>(null)
  const [dragSectionId, setDragSectionId] = React.useState<string | null>(null)
  const [dragOverSectionOrder, setDragOverSectionOrder] = React.useState<{ targetId: string; position: "above" | "below" } | null>(null)

  const [showArchived, setShowArchived] = React.useState(false)
  const [archivingId, setArchivingId] = React.useState<string | null>(null)

  const [changeRange, setChangeRange] = React.useState<ChangeRangeId>("1d")
  const [periodChange, setPeriodChange] = React.useState<{ delta: number; pct: number | null } | null>(null)
  const [periodChangeLoading, setPeriodChangeLoading] = React.useState(false)

  const quotesKeyRef = React.useRef<string>("")
  const fxKeyRef = React.useRef<string>("")
  const quotesRequestIdRef = React.useRef(0)
  const fxRequestIdRef = React.useRef(0)
  const changeRunIdRef = React.useRef(0)

  // Persist change range to cookie
  React.useEffect(() => {
    if (typeof document === "undefined") return
    const value = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${ASSET_CHANGE_RANGE_COOKIE}=`))
      ?.split("=")[1]
    if (value && CHANGE_RANGES.some((item) => item.id === value)) {
      setChangeRange(value as ChangeRangeId)
    }
  }, [])
  React.useEffect(() => {
    if (typeof document === "undefined") return
    document.cookie = `${ASSET_CHANGE_RANGE_COOKIE}=${changeRange}; path=/; max-age=31536000; samesite=lax`
  }, [changeRange])

  const loadAssets = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextAssets, nextTransactions, docs, mutations, nextSheets, nextSections, nextItems, nextCurrencies, nextClasses] =
        await Promise.all([
          fetchEntityAssets(entityUUID),
          fetchEntityTransactions(entityUUID).catch(() => [] as EntityTransaction[]),
          fetchDocuments(entityUUID).catch(() => []),
          fetchEntityMutations(entityUUID).catch(() => []),
          fetchEntitySheets(entityUUID, "asset").catch(() => [] as EntitySheet[]),
          fetchEntitySections(entityUUID).catch(() => [] as EntitySection[]),
          fetchEntitySheetItems(entityUUID).catch(() => [] as EntitySheetItem[]),
          fetch("/api/currencies").then(r => r.ok ? r.json() : []).catch(() => []),
          fetch("/api/asset-classes").then(r => r.ok ? r.json() : []).catch(() => []),
        ])

      setAssets(nextAssets)
      setTransactions(nextTransactions)
      setSheets(nextSheets)
      setSections(nextSections)
      setSheetItems(nextItems)
      setCurrencies(nextCurrencies)
      setAssetClasses(nextClasses)

      const txOnlyBalances = new Map<string, number>()
      for (const tx of nextTransactions) {
        for (const leg of tx.legs) {
          const current = txOnlyBalances.get(leg.assetId) ?? 0
          txOnlyBalances.set(leg.assetId, leg.direction === "in" ? current + leg.amount : current - leg.amount)
        }
      }
      const balances = new Map<string, number>(txOnlyBalances)
      for (const mutation of mutations) {
        const current = balances.get(mutation.assetId) ?? 0
        balances.set(mutation.assetId, current + mutation.delta)
      }
      setAssetBalances(balances)
      setAllMutations(mutations)

      const counts = new Map<string, number>()
      for (const doc of docs) {
        counts.set(doc.objectId, (counts.get(doc.objectId) ?? 0) + 1)
      }
      setDocCounts(counts)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load assets.")
    } finally {
      setLoading(false)
    }
  }, [entityUUID])

  React.useEffect(() => { void loadAssets() }, [loadAssets])

  React.useEffect(() => {
    const handler = () => void loadAssets()
    window.addEventListener(ENTITY_ASSETS_CHANGED_EVENT, handler)
    return () => window.removeEventListener(ENTITY_ASSETS_CHANGED_EVENT, handler)
  }, [loadAssets])

  React.useEffect(() => {
    if (activeSheetId === ALL_ASSETS_SHEET_ID) return
    if (!sheets.some((sheet) => sheet.id === activeSheetId)) {
      setActiveSheetId(ALL_ASSETS_SHEET_ID)
    }
  }, [sheets, activeSheetId])

  React.useEffect(() => {
    if (!selectedAsset) return
    if (!assets.some((asset) => asset.id === selectedAsset.id)) {
      setSelectedAsset(null)
      setSheetOpen(false)
    }
  }, [assets, selectedAsset])

  React.useEffect(() => {
    const targetAssetId = searchParams.get("asset")
    if (!targetAssetId) return
    const targetAsset = assets.find((asset) => asset.id === targetAssetId)
    if (!targetAsset) return
    setSelectedAsset(targetAsset)
    setSheetOpen(true)
  }, [assets, searchParams])

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Live quote listener
  React.useEffect(() => {
    const onLiveQuote = (event: Event) => {
      const custom = event as CustomEvent<{ ticker?: string; price?: number; asOf?: number }>
      const ticker = custom.detail?.ticker?.trim().toUpperCase()
      const price = custom.detail?.price
      if (!ticker || typeof price !== "number" || !Number.isFinite(price) || price <= 0) return
      setLiveQuotesByTicker((prev) => ({
        ...prev,
        [ticker]: {
          price,
          asOf: typeof custom.detail?.asOf === "number" ? custom.detail.asOf : Date.now(),
        },
      }))
    }
    window.addEventListener(LIVE_QUOTE_UPDATED_EVENT, onLiveQuote as EventListener)
    return () => window.removeEventListener(LIVE_QUOTE_UPDATED_EVENT, onLiveQuote as EventListener)
  }, [])

  // Load live quotes when assets change
  React.useEffect(() => {
    const tickers = Array.from(
      new Set(
        assets
          .map((asset) => asset.instrument?.ticker?.trim().toUpperCase() || "")
          .filter((ticker) => !!ticker),
      ),
    ).sort()
    const tickersKey = tickers.join("|")
    if (tickersKey === quotesKeyRef.current) return
    quotesKeyRef.current = tickersKey

    if (tickers.length === 0) {
      quotesRequestIdRef.current += 1
      setLiveQuotesByTicker({})
      setQuotesLoading(false)
      return
    }

    const requestId = ++quotesRequestIdRef.current
    const loadQuotes = async () => {
      setQuotesLoading(true)
      const next: Record<string, { price: number; asOf: number | null }> = {}
      try {
        await Promise.all(
          tickers.map(async (ticker) => {
            try {
              const quote = await fetchMarketQuote(ticker)
              if (typeof quote.price === "number" && Number.isFinite(quote.price) && quote.price > 0) {
                next[ticker] = { price: quote.price, asOf: typeof quote.asOf === "number" ? quote.asOf : null }
              }
            } catch {
              // ignore quote failures
            }
          }),
        )
        if (requestId === quotesRequestIdRef.current) setLiveQuotesByTicker(next)
      } finally {
        if (requestId === quotesRequestIdRef.current) setQuotesLoading(false)
      }
    }
    void loadQuotes()
  }, [assets])

  // Compute live stake values for equity_stake assets.
  // Fund stakes: use fund_mutation share records (net shares × share_class.current_nav).
  // Non-fund stakes (companies etc.): use ownershipPct × company live NAV.
  React.useEffect(() => {
    const stakeAssets = assets.filter(
      (a) => a.capTableShareholder && a.investable === "equity_stake"
    )
    if (stakeAssets.length === 0) {
      setStakeValuesByAsset(new Map())
      return
    }

    // Split into fund-based stakes (have fundId + shareholderEntityId) vs non-fund
    const fundStakes = stakeAssets.filter((a) => a.fundId && a.shareholderEntityId)
    const nonFundStakes = stakeAssets.filter((a) => !a.fundId && a.ownershipPct != null && a.shareholderEntityId)

    const load = async () => {
      const next = new Map<string, number>()

      // Fund stakes: compute from fund_mutation shares × current_nav
      await Promise.all(
        fundStakes.map(async (asset) => {
          try {
            const params = new URLSearchParams({
              shareholder: asset.capTableShareholder!,
              fundEntity: asset.shareholderEntityId!,
            })
            const res = await fetch(`/api/cap-table-stake-value-by-shares?${params}`)
            if (res.ok) {
              const data = (await res.json()) as { value?: number }
              if (typeof data.value === "number" && data.value > 0) {
                next.set(asset.id, data.value)
                return
              }
            }
          } catch { /* ignore */ }
          // Fallback to book value
          if (asset.stakeValue != null) next.set(asset.id, asset.stakeValue)
        })
      )

      // Non-fund stakes: compute from ownershipPct × company live NAV
      const uniqueEntities = Array.from(new Set(nonFundStakes.map((a) => a.shareholderEntityId!)))
      const navByEntity = new Map<string, number>()
      await Promise.all(
        uniqueEntities.map(async (entityUUID) => {
          try {
            const params = new URLSearchParams({ entityUUID })
            if (baseCurrencyProp) params.set("baseCurrency", baseCurrencyProp)
            const res = await fetch(`/api/net-worth?${params}`)
            if (res.ok) {
              const data = (await res.json()) as { netWorth?: number }
              if (typeof data.netWorth === "number") navByEntity.set(entityUUID, data.netWorth)
            }
          } catch { /* ignore */ }
        })
      )
      for (const asset of nonFundStakes) {
        const nav = navByEntity.get(asset.shareholderEntityId!)
        if (nav != null && asset.ownershipPct != null) {
          next.set(asset.id, asset.ownershipPct * nav)
        } else if (asset.stakeValue != null) {
          next.set(asset.id, asset.stakeValue)
        }
      }

      setStakeValuesByAsset(next)
    }
    void load()
  }, [assets, baseCurrencyProp])

  const baseCurrency = React.useMemo(() => {
    if (baseCurrencyProp) return baseCurrencyProp.trim().toUpperCase()
    return assets.find((a) => a.currencyCode)?.currencyCode?.trim().toUpperCase() || "USD"
  }, [baseCurrencyProp, assets])

  const orderedAssets = React.useMemo(() => {
    return [...assets].sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER
      const bo = b.order ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      const at = Date.parse(a.createdAt) || 0
      const bt = Date.parse(b.createdAt) || 0
      return at - bt
    })
  }, [assets])

  const normalizeCurrency = React.useCallback(
    (code?: string | null) => (code || baseCurrency).trim().toUpperCase(),
    [baseCurrency],
  )

  const toBaseCurrency = React.useCallback(
    (amount: number, fromCurrency?: string | null) => {
      const base = normalizeCurrency(baseCurrency)
      const from = normalizeCurrency(fromCurrency)
      if (!Number.isFinite(amount)) return 0
      if (from === base) return amount
      const rate = fxRates[from]
      if (!rate || !Number.isFinite(rate) || rate <= 0) return amount
      return amount * rate
    },
    [baseCurrency, fxRates, normalizeCurrency],
  )

  const getAssetNativeValue = React.useCallback(
    (asset: EntityAsset) => {
      return assetBalances.get(asset.id) ?? 0
    },
    [assetBalances],
  )

  const formatAge = React.useCallback(
    (asOf: number | null) => {
      if (!asOf) return ""
      const diffSec = Math.max(0, Math.floor((nowMs - asOf) / 1000))
      if (diffSec < 5) return "just refreshed"
      if (diffSec < 60) return `${diffSec}s ago`
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
      const hours = Math.floor(diffSec / 3600)
      const mins = Math.floor((diffSec % 3600) / 60)
      return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`
    },
    [nowMs],
  )

  // Load FX rates when currencies change
  React.useEffect(() => {
    const base = normalizeCurrency(baseCurrency)
    const needed = Array.from(
      new Set(
        assets
          .map((asset) => normalizeCurrency(asset.currencyCode))
          .filter((code) => code !== base),
      ),
    ).sort()
    const fxKey = `${base}|${needed.join("|")}`
    if (fxKey === fxKeyRef.current) return
    fxKeyRef.current = fxKey
    const requestId = ++fxRequestIdRef.current
    const loadFx = async () => {
      setFxLoading(true)
      try {
        const nextRates = await fetchFxRates(base, needed)
        if (requestId === fxRequestIdRef.current) {
          setFxRates({ [base]: 1, ...nextRates })
        }
      } catch {
        if (requestId === fxRequestIdRef.current) setFxRates({ [base]: 1 })
      } finally {
        if (requestId === fxRequestIdRef.current) setFxLoading(false)
      }
    }
    void loadFx()
  }, [assets, baseCurrency, normalizeCurrency])

  const valuationLoading = loading

  const getAssetUnits = React.useCallback(
    (assetId: string) => {
      let units: number | null = null
      for (const tx of transactions) {
        for (const leg of tx.legs) {
          if (leg.assetId !== assetId || leg.units == null) continue
          units = (units ?? 0) + (leg.direction === "in" ? leg.units : -leg.units)
        }
      }
      return units
    },
    [transactions],
  )

  const getLiveNativeValue = React.useCallback(
    (asset: EntityAsset) => {
      // Listed ticker: units × live quote
      const ticker = asset.instrument?.ticker?.trim().toUpperCase() || ""
      const quoteInfo = ticker ? (liveQuotesByTicker[ticker] ?? null) : null
      if (!quoteInfo) return getAssetNativeValue(asset)
      const units = getAssetUnits(asset.id)
      return units != null ? quoteInfo.price * units : quoteInfo.price
    },
    [getAssetNativeValue, liveQuotesByTicker, getAssetUnits],
  )

  // Returns the live value already in baseCurrency (handles equity stakes directly)
  const getBaseValue = React.useCallback(
    (asset: EntityAsset) => {
      if (asset.capTableShareholder) {
        const stakeValue = stakeValuesByAsset.get(asset.id)
        if (stakeValue !== undefined) return stakeValue
      }
      return toBaseCurrency(getLiveNativeValue(asset), asset.currencyCode)
    },
    [stakeValuesByAsset, getLiveNativeValue, toBaseCurrency],
  )

  const portfolioValue = React.useMemo(
    () => orderedAssets.reduce((sum, asset) => sum + getBaseValue(asset), 0),
    [orderedAssets, getBaseValue],
  )

  // Cache assets value for dashboard entity cards
  React.useEffect(() => {
    if (loading) return
    fetch(`/api/entity-stats/${entityUUID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetsValue: portfolioValue, assetsCount: orderedAssets.length }),
    }).catch(() => {})
    notifyAssetsUpdate(entityUUID, portfolioValue)
  }, [loading, entityUUID, portfolioValue, orderedAssets.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRange = React.useMemo(
    () => CHANGE_RANGES.find((item) => item.id === changeRange) ?? CHANGE_RANGES[0],
    [changeRange],
  )

  // Period change calculation
  React.useEffect(() => {
    if (orderedAssets.length === 0) {
      setPeriodChange({ delta: 0, pct: null })
      return
    }
    const runId = ++changeRunIdRef.current
    let cancelled = false
    const calculate = async () => {
      setPeriodChangeLoading(true)
      try {
        const at = Date.now() - selectedRange.ms
        let pastTotal = 0
        await Promise.all(
          orderedAssets.map(async (asset) => {
            const ticker = asset.instrument?.ticker?.trim().toUpperCase() || ""
            let pastNative: number

            if (asset.capTableShareholder) {
              // Equity stake: no historical NAV available — use current value
              pastTotal += getBaseValue(asset)
            } else if (ticker) {
              // Live asset: use historical market price × units
              pastNative = getLiveNativeValue(asset)
              try {
                const point = await fetchMarketPriceAt(ticker, at)
                if (typeof point.price === "number" && Number.isFinite(point.price) && point.price > 0) {
                  const units = getAssetUnits(asset.id)
                  pastNative = units != null ? point.price * units : point.price
                }
              } catch {
                // ignore — fall back to current live value
              }
              pastTotal += toBaseCurrency(pastNative, asset.currencyCode)
            } else {
              // Non-live asset: rewind balance by removing mutations and tx legs after `at`
              const currentBalance = getAssetNativeValue(asset)

              const mutationDeltaAfter = allMutations
                .filter((m) => m.assetId === asset.id && m.date > at)
                .reduce((s, m) => s + m.delta, 0)

              const txDeltaAfter = transactions
                .filter((tx) => tx.date > at)
                .flatMap((tx) => tx.legs)
                .filter((leg) => leg.assetId === asset.id)
                .reduce((s, leg) => s + (leg.direction === "in" ? leg.amount : -leg.amount), 0)

              pastNative = currentBalance - mutationDeltaAfter - txDeltaAfter
              pastTotal += toBaseCurrency(pastNative, asset.currencyCode)
            }
          }),
        )
        if (cancelled || runId !== changeRunIdRef.current) return
        const delta = portfolioValue - pastTotal
        const pct = pastTotal > 0 ? (delta / pastTotal) * 100 : null
        setPeriodChange({ delta, pct })
      } finally {
        if (!cancelled && runId === changeRunIdRef.current) setPeriodChangeLoading(false)
      }
    }
    void calculate()
    return () => { cancelled = true }
  }, [selectedRange, orderedAssets, toBaseCurrency, portfolioValue, getLiveNativeValue, getBaseValue, getAssetUnits, getAssetNativeValue, allMutations, transactions])

  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId) ?? null
  const activeSheetSections = React.useMemo(
    () =>
      activeSheetId === ALL_ASSETS_SHEET_ID
        ? []
        : sections
            .filter((section) => section.sheetId === activeSheetId)
            .sort((a, b) => a.order - b.order),
    [sections, activeSheetId],
  )

  const activeSheetAssetLink = React.useMemo(() => {
    const map = new Map<string, EntitySheetItem>()
    if (activeSheetId === ALL_ASSETS_SHEET_ID) return map
    const relevant = sheetItems
      .filter(
        (item) => item.sheetId === activeSheetId && item.objectType.toLowerCase() === "asset",
      )
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    for (const item of relevant) map.set(item.objectId, item)
    return map
  }, [sheetItems, activeSheetId])

  const assetsInActiveSheet = React.useMemo(() => {
    const base = activeSheetId === ALL_ASSETS_SHEET_ID
      ? orderedAssets
      : orderedAssets.filter((asset) => activeSheetAssetLink.has(asset.id))
    return showArchived ? base : base.filter((a) => !a.archived)
  }, [orderedAssets, activeSheetAssetLink, activeSheetId, showArchived])

  const archivedCount = React.useMemo(() =>
    (activeSheetId === ALL_ASSETS_SHEET_ID ? orderedAssets : orderedAssets.filter((a) => activeSheetAssetLink.has(a.id)))
      .filter((a) => a.archived).length,
    [orderedAssets, activeSheetAssetLink, activeSheetId],
  )

  const assetsNotInActiveSheet = React.useMemo(() => {
    if (activeSheetId === ALL_ASSETS_SHEET_ID) return []
    return orderedAssets.filter((asset) => !activeSheetAssetLink.has(asset.id))
  }, [orderedAssets, activeSheetAssetLink, activeSheetId])

  const sheetAssetIds = React.useMemo(() => {
    const bySheet = new Map<string, Set<string>>()
    for (const item of sheetItems) {
      if (item.objectType.toLowerCase() !== "asset") continue
      if (!bySheet.has(item.sheetId)) bySheet.set(item.sheetId, new Set())
      bySheet.get(item.sheetId)?.add(item.objectId)
    }
    return bySheet
  }, [sheetItems])

  const getSheetValue = React.useCallback(
    (sheetId: string) => {
      if (sheetId === ALL_ASSETS_SHEET_ID) {
        return orderedAssets.reduce((sum, asset) => sum + getBaseValue(asset), 0)
      }
      const ids = sheetAssetIds.get(sheetId)
      if (!ids) return 0
      return orderedAssets.reduce((sum, asset) => {
        if (!ids.has(asset.id)) return sum
        return sum + getBaseValue(asset)
      }, 0)
    },
    [orderedAssets, getBaseValue, sheetAssetIds],
  )

  const sectionGroups = React.useMemo(() => {
    if (activeSheetId === ALL_ASSETS_SHEET_ID) return []
    const groups: Array<{ section: EntitySection | null; assets: EntityAsset[]; total: number }> =
      activeSheetSections.map((section) => {
        const sectionAssets = assetsInActiveSheet.filter((asset) => {
          const link = activeSheetAssetLink.get(asset.id)
          return link?.sectionId === section.id
        })
        return {
          section,
          assets: sectionAssets,
          total: sectionAssets.reduce((sum, asset) => sum + getBaseValue(asset), 0),
        }
      })

    const unsectionedAssets = assetsInActiveSheet.filter((asset) => {
      const link = activeSheetAssetLink.get(asset.id)
      return !link?.sectionId
    })

    if (unsectionedAssets.length > 0) {
      groups.unshift({
        section: null,
        assets: unsectionedAssets,
        total: unsectionedAssets.reduce((sum, asset) => sum + getBaseValue(asset), 0),
      })
    }

    return groups
  }, [activeSheetId, activeSheetSections, assetsInActiveSheet, activeSheetAssetLink, getBaseValue])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleArchiveAsset = async (assetId: string, archived: boolean) => {
    setArchivingId(assetId)
    try {
      await updateEntityAsset(assetId, { archived })
      await loadAssets()
    } catch {
      // silently ignore — asset will still show as-is
    } finally {
      setArchivingId(null)
    }
  }

  const getDropPosition = (event: React.DragEvent<HTMLTableRowElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY < rect.top + rect.height / 2 ? "above" : "below"
  }

  const handlePersistOrder = async (draggedId: string, targetId: string, position: "above" | "below") => {
    if (reordering) return
    const sourceIndex = orderedAssets.findIndex((a) => a.id === draggedId)
    const targetIndex = orderedAssets.findIndex((a) => a.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return

    const nextAssets = [...orderedAssets]
    const [moved] = nextAssets.splice(sourceIndex, 1)
    let insertIndex = targetIndex + (position === "below" ? 1 : 0)
    if (sourceIndex < insertIndex) insertIndex -= 1
    nextAssets.splice(insertIndex, 0, moved)

    const orderById = new Map(nextAssets.map((asset, index) => [asset.id, index + 1]))
    const changed = nextAssets.filter((asset, index) => (asset.order ?? 0) !== index + 1)
    if (changed.length === 0) return

    setReordering(true)
    setAssets((prev) => prev.map((asset) => ({ ...asset, order: orderById.get(asset.id) ?? asset.order })))

    try {
      await Promise.all(changed.map((asset) => updateEntityAsset(asset.id, { order: orderById.get(asset.id) })))
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to reorder assets.")
      await loadAssets()
    } finally {
      setReordering(false)
    }
  }

  const handleMoveAssetToSection = async (assetId: string, targetSectionId: string | null) => {
    if (!activeSheet) return
    const link = activeSheetAssetLink.get(assetId)
    if (!link) return
    const currentSectionId = link.sectionId ?? null
    if (currentSectionId === targetSectionId) return

    const targetOrder =
      sheetItems
        .filter(
          (item) =>
            item.sheetId === activeSheet.id &&
            item.objectType.toLowerCase() === "asset" &&
            (item.sectionId ?? null) === targetSectionId,
        )
        .reduce((max, item) => Math.max(max, item.order), 0) + 1

    setSheetItems((prev) =>
      prev.map((item) =>
        item.id === link.id ? { ...item, sectionId: targetSectionId, order: targetOrder } : item,
      ),
    )

    try {
      await updateEntitySheetItem(link.id, { sectionId: targetSectionId, order: targetOrder })
      setSectionDropTargetId(null)
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to move asset to section.")
      await loadAssets()
    }
  }

  const handlePersistSheetOrder = async (draggedId: string, targetId: string, position: "before" | "after") => {
    if (reordering) return
    const sourceIndex = sheets.findIndex((s) => s.id === draggedId)
    const targetIndex = sheets.findIndex((s) => s.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return

    const nextSheets = [...sheets]
    const [moved] = nextSheets.splice(sourceIndex, 1)
    let insertIndex = targetIndex + (position === "after" ? 1 : 0)
    if (sourceIndex < insertIndex) insertIndex -= 1
    nextSheets.splice(insertIndex, 0, moved)

    const orderById = new Map(nextSheets.map((s, i) => [s.id, i + 1]))
    const changed = nextSheets.filter((s, i) => (s.order ?? 0) !== i + 1)
    if (changed.length === 0) return

    setReordering(true)
    setSheets((prev) => prev.map((s) => ({ ...s, order: orderById.get(s.id) ?? s.order })))
    try {
      await Promise.all(changed.map((s) => updateEntitySheet(s.id, { order: orderById.get(s.id) })))
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to reorder sheets.")
      await loadAssets()
    } finally {
      setReordering(false)
    }
  }

  const handlePersistSectionOrder = async (draggedId: string, targetId: string, position: "above" | "below") => {
    if (!activeSheet || reordering) return
    const sourceIndex = activeSheetSections.findIndex((s) => s.id === draggedId)
    const targetIndex = activeSheetSections.findIndex((s) => s.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return

    const nextSections = [...activeSheetSections]
    const [moved] = nextSections.splice(sourceIndex, 1)
    let insertIndex = targetIndex + (position === "below" ? 1 : 0)
    if (sourceIndex < insertIndex) insertIndex -= 1
    nextSections.splice(insertIndex, 0, moved)

    const orderById = new Map(nextSections.map((s, i) => [s.id, i + 1]))
    const changed = nextSections.filter((s, i) => (s.order ?? 0) !== i + 1)
    if (changed.length === 0) return

    setReordering(true)
    setSections((prev) =>
      prev.map((section) => {
        if (section.sheetId !== activeSheet.id) return section
        return { ...section, order: orderById.get(section.id) ?? section.order }
      }),
    )
    try {
      await Promise.all(changed.map((s) => updateEntitySection(s.id, { order: orderById.get(s.id) })))
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to reorder sections.")
      await loadAssets()
    } finally {
      setReordering(false)
    }
  }

  const handleCreateSheet = async (name: string, description: string) => {
    setSavingSheet(true)
    setSheetError(null)
    try {
      await createEntitySheet({
        entityId: entityUUID,
        type: "asset",
        name,
        description,
        order: sheets.length + 1,
      })
      await loadAssets()
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to create sheet.")
    } finally {
      setSavingSheet(false)
    }
  }

  const handleCreateSection = async (name: string, description: string) => {
    if (!activeSheet) return
    setSavingSection(true)
    setSheetError(null)
    try {
      await createEntitySection({
        entityId: entityUUID,
        sheetId: activeSheet.id,
        name,
        description,
        order: activeSheetSections.length + 1,
      })
      await loadAssets()
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to create section.")
    } finally {
      setSavingSection(false)
    }
  }

  const handleAssignAssetToSheet = async (assetId: string, sectionId: string) => {
    if (!activeSheet) return
    setSavingItem(true)
    setSheetError(null)
    try {
      await createEntitySheetItem({
        entityId: entityUUID,
        sheetId: activeSheet.id,
        sectionId: sectionId || null,
        objectType: "asset",
        objectId: assetId,
        order: sheetItems.filter((item) => item.sheetId === activeSheet.id).length + 1,
      })
      await loadAssets()
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to add asset to sheet.")
    } finally {
      setSavingItem(false)
    }
  }

  const openSheetEdit = (sheet: EntitySheet) => {
    setSheetError(null)
    setEditingSection(null)
    setEditingSheet(sheet)
  }

  const openSectionEdit = (section: EntitySection) => {
    setSheetError(null)
    setEditingSheet(null)
    setEditingSection(section)
  }

  const handleSaveSheetEdit = async (name: string, description: string) => {
    if (!editingSheet) return
    setSheetError(null)
    try {
      await updateEntitySheet(editingSheet.id, { name, description })
      setEditingSheet(null)
      await loadAssets()
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to update sheet.")
    }
  }

  const handleSaveSectionEdit = async (name: string, description: string) => {
    if (!editingSection) return
    setSheetError(null)
    try {
      await updateEntitySection(editingSection.id, { name, description })
      setEditingSection(null)
      await loadAssets()
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to update section.")
    }
  }

  // ─── Asset table renderer ──────────────────────────────────────────────────

  const renderAssetTable = (rows: EntityAsset[], allowRowReorder = true) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-200 text-left text-sm">
        <thead className="text-muted-foreground border-b">
          <tr>
            <th className="w-8 px-2 py-2 font-medium" />
            <th className="px-3 py-2 font-medium">Asset details</th>
            <th className="px-3 py-2 font-medium">In / Out</th>
            <th className="px-3 py-2 font-medium">Market value</th>
            <th className="px-3 py-2 font-medium">Gain / Loss</th>
            <th className="px-3 py-2 font-medium">Docs</th>
            <th className="px-3 py-2 font-medium">Manage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((asset) => (
            <tr
              key={asset.id}
              draggable={!reordering}
              onDragStart={() => { setDragAssetId(asset.id); setDragOver(null) }}
              onDragOver={(event) => {
                if (!allowRowReorder) return
                if (!dragAssetId || dragAssetId === asset.id) return
                event.preventDefault()
                setDragOver({ targetId: asset.id, position: getDropPosition(event) })
              }}
              onDrop={(event) => {
                if (!allowRowReorder) return
                event.preventDefault()
                if (!dragAssetId || dragAssetId === asset.id) return
                void handlePersistOrder(dragAssetId, asset.id, getDropPosition(event))
                setDragAssetId(null)
                setDragOver(null)
              }}
              onDragEnd={() => { setDragAssetId(null); setDragOver(null) }}
              className={`border-b last:border-b-0 ${dragAssetId === asset.id ? "opacity-70" : asset.archived ? "opacity-50" : ""}`}
              style={
                allowRowReorder && dragOver?.targetId === asset.id
                  ? dragOver.position === "above"
                    ? { boxShadow: "inset 0 2px 0 hsl(var(--primary))" }
                    : { boxShadow: "inset 0 -2px 0 hsl(var(--primary))" }
                  : undefined
              }
            >
              <td className="px-2 py-3 align-top text-muted-foreground">
                <button
                  type="button"
                  className="cursor-grab active:cursor-grabbing"
                  aria-label={`Drag to reorder ${asset.name}`}
                >
                  <GripVertical className="size-4" />
                </button>
              </td>
              <td className="px-3 py-3">
                {(() => {
                  const isCashAsset = asset.className?.toLowerCase().includes("cash") ?? false
                  let totalIn = 0
                  let totalOut = 0
                  let netUnits: number | null = asset.instrument?.ticker ? 0 : null
                  for (const tx of transactions) {
                    if (!isCapitalTransaction(tx)) continue
                    for (const leg of tx.legs) {
                      if (leg.assetId !== asset.id) continue
                      if (leg.direction === "in") totalIn += leg.amount
                      else totalOut += leg.amount
                      if (netUnits !== null && leg.units != null) {
                        netUnits += leg.direction === "in" ? leg.units : -leg.units
                      }
                    }
                  }
                  const isSoldAsset = !isCashAsset && totalOut > 0
                    && (netUnits !== null ? netUnits <= 0 : true)
                  const gainLoss = totalOut - totalIn
                  const gainLossPct = totalIn !== 0 ? (gainLoss / totalIn) * 100 : 0
                  const isUp = gainLoss >= 0
                  return (
                    <>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium">{asset.name}</p>
                        {isSoldAsset && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">Sold</span>
                        )}
                      </div>
                      {asset.className && (
                        <p className="text-xs text-muted-foreground">{asset.className}</p>
                      )}
                      {asset.instrument?.ticker && (
                        <p className="text-xs text-muted-foreground">{asset.instrument.ticker}</p>
                      )}
                      {isSoldAsset && (
                        <p className={`text-xs font-medium ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                          {isUp ? "+" : "−"}{formatCurrency(Math.abs(gainLoss), asset.currencyCode)} ({gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(1)}%)
                        </p>
                      )}
                    </>
                  )
                })()}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {(() => {
                  const isCashAsset = asset.className?.toLowerCase().includes("cash") ?? false
                  if (isCashAsset) return <span className="text-muted-foreground">—</span>

                  let totalIn = 0
                  let totalOut = 0
                  for (const tx of transactions) {
                    for (const leg of tx.legs) {
                      if (leg.assetId !== asset.id) continue
                      if (leg.direction === "in") totalIn += leg.amount
                      else totalOut += leg.proceeds ?? leg.amount
                    }
                  }
                  if (totalIn === 0 && totalOut === 0) {
                    return <span className="text-muted-foreground">—</span>
                  }
                  return (
                    <span>
                      In {formatCurrency(totalIn, asset.currencyCode)}
                      <br />
                      Out {formatCurrency(totalOut, asset.currencyCode)}
                    </span>
                  )
                })()}
              </td>
              <td className="px-3 py-3">
                {(() => {
                  if (valuationLoading) {
                    return (
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    )
                  }
                  // Equity stake: value comes from cap table NAV
                  const stakeValue = asset.capTableShareholder
                    ? (stakeValuesByAsset.get(asset.id) ?? null)
                    : null
                  const stakeLoading = asset.capTableShareholder && stakeValue === null

                  if (stakeLoading) {
                    return (
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    )
                  }

                  if (stakeValue !== null) {
                    // Already in base currency — also show native currency if different
                    const assetCurr = normalizeCurrency(asset.currencyCode)
                    const baseCurr = normalizeCurrency(baseCurrency)
                    const fxRate = fxRates[assetCurr]
                    const nativeStakeValue =
                      assetCurr !== baseCurr && fxRate && fxRate > 0
                        ? stakeValue / fxRate
                        : null
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span>{formatCurrency(stakeValue, baseCurrency)}</span>
                        <span className="text-muted-foreground text-xs">
                          {nativeStakeValue !== null
                            ? `${formatCurrency(nativeStakeValue, assetCurr)} · NAV · live`
                            : "NAV · live"}
                        </span>
                      </div>
                    )
                  }

                  const costBasis = getAssetNativeValue(asset)
                  const ticker = asset.instrument?.ticker?.trim().toUpperCase() || ""
                  const quoteInfo = ticker ? (liveQuotesByTicker[ticker] ?? null) : null
                  const assetCurrency = normalizeCurrency(asset.currencyCode)
                  const isDifferentCurrency = assetCurrency !== normalizeCurrency(baseCurrency)

                  // Compute live market value when quote is available
                  let liveUnits: number | null = null
                  if (quoteInfo) {
                    for (const tx of transactions) {
                      for (const leg of tx.legs) {
                        if (leg.assetId !== asset.id || leg.units == null) continue
                        liveUnits = (liveUnits ?? 0) + (leg.direction === "in" ? leg.units : -leg.units)
                      }
                    }
                  }
                  const nativeValue = quoteInfo
                    ? (liveUnits != null ? quoteInfo.price * liveUnits : quoteInfo.price)
                    : costBasis
                  const convertedValue = toBaseCurrency(nativeValue, asset.currencyCode)
                  const mainValue = formatCurrency(convertedValue, baseCurrency)
                  const originalValue = formatCurrency(nativeValue, assetCurrency)

                  if (costBasis === 0 && !quoteInfo) {
                    return <span className="text-muted-foreground">—</span>
                  }

                  const hasNoTxLegs = !transactions.some((tx) =>
                    tx.legs.some((leg) => leg.assetId === asset.id),
                  )

                  if (hasNoTxLegs && costBasis > 0 && !ticker) {
                    return (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex cursor-default flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1">
                                {mainValue}
                                <HelpCircle className="size-3.5 shrink-0 text-amber-500" />
                              </span>
                              {isDifferentCurrency && (
                                <span className="text-muted-foreground text-xs">{originalValue}</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-56 text-xs">
                            Value is from the asset record, not a confirmed transaction.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  }

                  return (
                    <div className="flex flex-col gap-0.5">
                      <span>{mainValue}</span>
                      {quoteInfo ? (
                        <span className="text-muted-foreground text-xs">
                          Live {formatCurrency(nativeValue, assetCurrency)} · {formatAge(quoteInfo.asOf)}
                        </span>
                      ) : isDifferentCurrency ? (
                        <span className="text-muted-foreground text-xs">{originalValue}</span>
                      ) : null}
                    </div>
                  )
                })()}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {(() => {
                  const isCashAsset = asset.className?.toLowerCase().includes("cash") ?? false
                  if (isCashAsset) return <span className="text-muted-foreground">—</span>

                  // Compute txIn / txOut for this asset
                  let txIn = 0
                  let txOut = 0
                  let netUnits: number | null = asset.instrument?.ticker ? 0 : null
                  for (const tx of transactions) {
                    if (!isCapitalTransaction(tx)) continue
                    for (const leg of tx.legs) {
                      if (leg.assetId !== asset.id) continue
                      if (leg.direction === "in") txIn += leg.amount
                      else txOut += leg.amount
                      if (netUnits !== null && leg.units != null) {
                        netUnits += leg.direction === "in" ? leg.units : -leg.units
                      }
                    }
                  }
                  const isSold = txOut > 0 && (netUnits !== null ? netUnits <= 0 : true)

                  // Sold assets: gain = proceeds − cost; use txIn as denominator
                  if (isSold) {
                    const gainLoss = txOut - txIn
                    const gainLossPct = txIn !== 0 ? (gainLoss / txIn) * 100 : 0
                    const isUp = gainLoss >= 0
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className={isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
                          {isUp ? "+" : "−"}{formatCurrency(Math.abs(gainLoss), asset.currencyCode)}
                        </span>
                        <span className={`text-xs ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                          {gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(2)}%
                        </span>
                      </div>
                    )
                  }

                  const ticker = asset.instrument?.ticker?.trim().toUpperCase() || ""
                  const quoteInfo = ticker ? (liveQuotesByTicker[ticker] ?? null) : null

                  if (quoteInfo) {
                    // Compute net units from transaction legs
                    let units: number | null = null
                    for (const tx of transactions) {
                      for (const leg of tx.legs) {
                        if (leg.assetId !== asset.id || leg.units == null) continue
                        units = (units ?? 0) + (leg.direction === "in" ? leg.units : -leg.units)
                      }
                    }
                    const liveValue = units != null ? quoteInfo.price * units : quoteInfo.price
                    const netCost = txIn - txOut || txIn
                    const gainLoss = liveValue - netCost
                    const gainLossPct = netCost !== 0 ? (gainLoss / netCost) * 100 : 0
                    const isUp = gainLoss >= 0
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className={isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
                          {isUp ? "+" : "−"}{formatCurrency(Math.abs(gainLoss), asset.currencyCode)}
                        </span>
                        <span className={`text-xs ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                          {gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(2)}%
                        </span>
                      </div>
                    )
                  }

                  // Equity stake: G/L = NAV-derived value vs cost basis (both converted to baseCurrency)
                  const stakeGlVal = asset.capTableShareholder ? (stakeValuesByAsset.get(asset.id) ?? null) : null
                  if (stakeGlVal !== null) {
                    const costNative = txIn || (assetBalances.get(asset.id) ?? 0)
                    const costBase = toBaseCurrency(costNative, asset.currencyCode)
                    const gl = stakeGlVal - costBase
                    const glPct = costBase !== 0 ? (gl / costBase) * 100 : 0
                    const isUp = gl >= 0
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className={isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
                          {isUp ? "+" : "−"}{formatCurrency(Math.abs(gl), baseCurrency)}
                        </span>
                        <span className={`text-xs ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                          {glPct >= 0 ? "+" : ""}{glPct.toFixed(2)}%
                        </span>
                      </div>
                    )
                  }

                  // For non-ticker assets: gain = current value (incl. revaluations) - net cost
                  const currentVal = assetBalances.get(asset.id) ?? 0
                  const netCost = txIn - txOut || txIn
                  const revalGain = currentVal - netCost
                  if (netCost === 0 && revalGain === 0) return <span className="text-muted-foreground">—</span>
                  const revalPct = netCost !== 0 ? (revalGain / netCost) * 100 : 0
                  const revalUp = revalGain >= 0
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className={revalUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
                        {revalUp ? "+" : "−"}{formatCurrency(Math.abs(revalGain), asset.currencyCode)}
                      </span>
                      <span className={`text-xs ${revalUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                        {revalPct >= 0 ? "+" : ""}{revalPct.toFixed(2)}%
                      </span>
                    </div>
                  )
                })()}
              </td>
              <td className="px-3 py-3">
                <UploadDocumentsDialog
                  entityId={asset.entityId}
                  objectType="asset"
                  objectId={asset.id}
                  onUploaded={() => void loadAssets()}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    <Paperclip className="size-3.5" />
                    {(docCounts.get(asset.id) ?? 0) > 0 ? docCounts.get(asset.id) : null}
                  </Button>
                </UploadDocumentsDialog>
              </td>
              <td className="px-3 py-3">
                {(() => {
                  const isCashAsset = asset.className?.toLowerCase().includes("cash") ?? false
                  let _netU: number | null = asset.instrument?.ticker ? 0 : null
                  const hasOutLeg = transactions.some((tx) => {
                    if (!isCapitalTransaction(tx)) return false
                    return tx.legs.some((l) => {
                      if (l.assetId !== asset.id) return false
                      if (_netU !== null && l.units != null) _netU += l.direction === "in" ? l.units : -l.units
                      return l.direction === "out"
                    })
                  })
                  const isSoldAsset = !isCashAsset && hasOutLeg
                    && (_netU !== null ? _netU <= 0 : true)
                  const assetCurrencyId = currencies.find(
                    (c) => c.code.toUpperCase() === normalizeCurrency(asset.currencyCode)
                  )?.id
                  const cashAssets = assets
                    .filter((a) => a.className?.toLowerCase().includes("cash"))
                    .map((a) => ({ id: a.id, name: a.name, currencyCode: a.currencyCode }))
                  const currentValue = assetBalances.get(asset.id) ?? 0

                  return (
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <span className="text-base leading-none">⋯</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {isCashAsset ? (
                            allowNewMoneyIn ? (
                            <MoneyInDialog
                              entityUUID={entityUUID}
                              assetId={asset.id}
                              assetName={asset.name ?? "Cash"}
                              currencies={currencies}
                              defaultCurrencyId={assetCurrencyId}
                              onSuccess={() => void loadAssets()}
                            >
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <ArrowDownLeft className="size-3.5" />
                                Money in
                              </DropdownMenuItem>
                            </MoneyInDialog>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <DropdownMenuItem disabled>
                                        <ArrowDownLeft className="size-3.5" />
                                        Money in
                                      </DropdownMenuItem>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-50">
                                    New money in is only available on portfolio entities. Use capital calls to receive funds here.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )
                          ) : (
                            <>
                              <BuySellDialog
                                entityUUID={entityUUID}
                                assetId={asset.id}
                                assetName={asset.name ?? "Asset"}
                                currencies={currencies}
                                defaultCurrencyId={assetCurrencyId}
                                cashAssets={cashAssets}
                                costBasis={currentValue}
                                instrument={asset.instrument}
                                allowNewMoneyIn={allowNewMoneyIn}
                                onSuccess={() => void loadAssets()}
                              >
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <ArrowLeftRight className="size-3.5" />
                                  Buy / Sell
                                </DropdownMenuItem>
                              </BuySellDialog>
                              {!isSoldAsset && !asset.instrument && (
                                <RevalueDialog
                                  entityId={asset.entityId}
                                  assetId={asset.id}
                                  assetName={asset.name ?? "Asset"}
                                  currentValue={currentValue}
                                  currencyCode={asset.currencyCode}
                                  onSuccess={() => void loadAssets()}
                                >
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <SlidersHorizontal className="size-3.5" />
                                    Revalue
                                  </DropdownMenuItem>
                                </RevalueDialog>
                              )}
                              {!isSoldAsset && asset.investable !== "investable_cash" && cashAssets.length > 0 && (
                                <DistributionDialog
                                  entityUUID={entityUUID}
                                  assetId={asset.id}
                                  assetName={asset.name ?? "Asset"}
                                  cashAssets={cashAssets.map((c) => ({ id: c.id, name: c.name, currencyCode: c.currencyCode }))}
                                  defaultCurrencyId={asset.currencyId ?? undefined}
                                  onSuccess={() => void loadAssets()}
                                >
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Banknote className="size-3.5" />
                                    Distribution
                                  </DropdownMenuItem>
                                </DistributionDialog>
                              )}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={archivingId === asset.id}
                            onSelect={() => void handleArchiveAsset(asset.id, !asset.archived)}
                            className={asset.archived ? "" : "text-muted-foreground"}
                          >
                            {asset.archived
                              ? <><ArchiveRestore className="size-3.5" />Unarchive</>
                              : <><Archive className="size-3.5" />Archive</>
                            }
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelectedAsset(asset); setSheetOpen(true) }}
                      >
                        Open
                      </Button>
                    </div>
                  )
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex w-full flex-col gap-6 p-6 md:p-8">

      {/* Card 1: Total value + period change */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Assets</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Add and manage asset holdings.
            </p>
          </div>
          <AddAssetDialog entityUUID={entityUUID} currencies={currencies} assetClasses={assetClasses} onCreated={loadAssets} allowNewMoneyIn={allowNewMoneyIn} defaultCurrencyCode={baseCurrencyProp} entityType={entityType}>
            <Button>
              <Plus />
              Add asset
            </Button>
          </AddAssetDialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Assets</p>
            {valuationLoading ? (
              <Skeleton className="mt-2 h-9 w-52" />
            ) : (
              <p className="mt-1 text-4xl font-semibold">
                {formatCurrency(portfolioValue, baseCurrency)}
              </p>
            )}
            {!loading && (fxLoading || quotesLoading) && (
              <p className="text-muted-foreground mt-1 text-xs">Updating live values...</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {CHANGE_RANGES.map((range) => {
                const selected = changeRange === range.id
                return (
                  <button
                    key={range.id}
                    type="button"
                    onClick={() => setChangeRange(range.id)}
                    className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="text-muted-foreground block uppercase tracking-wide">{range.label}</span>
                    {periodChangeLoading && selected ? (
                      <Skeleton className="mt-1 h-4 w-24" />
                    ) : selected && periodChange ? (
                      <span
                        className={`mt-1 block text-sm font-semibold ${
                          periodChange.delta >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {periodChange.delta >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(periodChange.delta), baseCurrency)}
                        {periodChange.pct != null
                          ? ` (${periodChange.delta >= 0 ? "+" : "−"}${Math.abs(periodChange.pct).toFixed(2)}%)`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground mt-1 block text-sm">View</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Sheet tiles + asset table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Asset Sheets</CardTitle>
          <CreateSheetDialog onSubmit={handleCreateSheet} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sheet tiles */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveSheetId(ALL_ASSETS_SHEET_ID)}
              className={`min-w-52 rounded-md border p-3 text-left ${activeSheetId === ALL_ASSETS_SHEET_ID ? "border-primary" : ""}`}
            >
              <p className="font-semibold">All Assets</p>
              {valuationLoading ? (
                <Skeleton className="mt-2 h-7 w-28" />
              ) : (
                <p className="mt-1 text-xl">{formatCurrency(getSheetValue(ALL_ASSETS_SHEET_ID), baseCurrency)}</p>
              )}
            </button>
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                draggable={!reordering}
                onDragStart={() => { setDragSheetId(sheet.id); setDragOverSheet(null) }}
                onDragOver={(event) => {
                  if (!dragSheetId || dragSheetId === sheet.id) return
                  event.preventDefault()
                  const rect = event.currentTarget.getBoundingClientRect()
                  const midpointX = rect.left + rect.width / 2
                  setDragOverSheet({ targetId: sheet.id, position: event.clientX < midpointX ? "before" : "after" })
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!dragSheetId || dragSheetId === sheet.id) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  const position = event.clientX < rect.left + rect.width / 2 ? "before" : "after"
                  void handlePersistSheetOrder(dragSheetId, sheet.id, position)
                  setDragSheetId(null)
                  setDragOverSheet(null)
                }}
                onDragEnd={() => { setDragSheetId(null); setDragOverSheet(null) }}
                className={`min-w-52 rounded-md border p-3 text-left ${activeSheetId === sheet.id ? "border-primary" : ""} ${dragSheetId === sheet.id ? "opacity-70" : ""}`}
                style={
                  dragOverSheet?.targetId === sheet.id
                    ? dragOverSheet.position === "before"
                      ? { boxShadow: "inset 2px 0 0 hsl(var(--primary))" }
                      : { boxShadow: "inset -2px 0 0 hsl(var(--primary))" }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setActiveSheetId(sheet.id)} className="text-left">
                    <p className="font-semibold">{sheet.name}</p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => openSheetEdit(sheet)}
                    aria-label={`Edit ${sheet.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
                <button type="button" onClick={() => setActiveSheetId(sheet.id)} className="mt-1 text-left">
                  {valuationLoading ? (
                    <Skeleton className="mt-1 h-7 w-28" />
                  ) : (
                    <p className="text-xl">{formatCurrency(getSheetValue(sheet.id), baseCurrency)}</p>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Section toolbar — only in custom sheets */}
          {activeSheet && (
            <div className="flex flex-wrap gap-2">
              <CreateSectionDialog
                sheetName={activeSheet.name}
                onSubmit={handleCreateSection}
              />
              <AddAssetToSheetDialog
                sheetName={activeSheet.name}
                sections={activeSheetSections}
                availableAssets={assetsNotInActiveSheet}
                onSubmit={handleAssignAssetToSheet}
              />
            </div>
          )}

          {sheetError && <p className="text-destructive text-sm">{sheetError}</p>}

          <EditSheetDialog
            sheet={editingSheet}
            onClose={() => setEditingSheet(null)}
            onSave={handleSaveSheetEdit}
          />
          <EditSectionDialog
            section={editingSection}
            onClose={() => setEditingSection(null)}
            onSave={handleSaveSectionEdit}
          />

          {/* Asset table */}
          {activeSheetId === ALL_ASSETS_SHEET_ID ? (
            <>
              {error && <p className="text-destructive text-sm">{error}</p>}
              {sheetError && <p className="text-destructive text-sm">{sheetError}</p>}
              {assetsInActiveSheet.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {loading ? "Loading assets..." : "No assets yet. Click Add asset to create your first record."}
                </p>
              ) : (
                renderAssetTable(assetsInActiveSheet)
              )}
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1.5 mt-1"
                >
                  {showArchived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                  {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
                </button>
              )}
            </>
          ) : (
            <div className="space-y-5">
              {error && <p className="text-destructive text-sm">{error}</p>}
              {sheetError && <p className="text-destructive text-sm">{sheetError}</p>}
              {assetsInActiveSheet.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {loading ? "Loading assets..." : "No assets in this sheet yet."}
                </p>
              ) : (
                sectionGroups.map((group) => {
                  const dropTargetId = group.section?.id ?? "__unsectioned__"
                  return (
                    <div
                      key={group.section?.id ?? "__unsectioned__"}
                      className={`space-y-3 rounded-md ${sectionDropTargetId === dropTargetId ? "ring-2 ring-primary/40" : ""}`}
                      onDragOver={(event) => {
                        if (dragSectionId) {
                          if (!group.section || dragSectionId === group.section.id) return
                          event.preventDefault()
                          const rect = event.currentTarget.getBoundingClientRect()
                          const midpointY = rect.top + rect.height / 2
                          setDragOverSectionOrder({ targetId: group.section.id, position: event.clientY < midpointY ? "above" : "below" })
                          return
                        }
                        if (dragAssetId) {
                          event.preventDefault()
                          setSectionDropTargetId(dropTargetId)
                        }
                      }}
                      onDragLeave={() => {
                        setSectionDropTargetId((current) => current === dropTargetId ? null : current)
                        if (group.section) {
                          setDragOverSectionOrder((current) => current?.targetId === group.section?.id ? null : current)
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (dragSectionId && group.section) {
                          if (dragSectionId === group.section.id) return
                          const rect = event.currentTarget.getBoundingClientRect()
                          const position = event.clientY < rect.top + rect.height / 2 ? "above" : "below"
                          void handlePersistSectionOrder(dragSectionId, group.section.id, position)
                          setDragSectionId(null)
                          setDragOverSectionOrder(null)
                          return
                        }
                        if (dragAssetId) {
                          void handleMoveAssetToSection(dragAssetId, group.section?.id ?? null)
                          setDragAssetId(null)
                          setDragOver(null)
                        }
                      }}
                      style={
                        group.section && dragOverSectionOrder?.targetId === group.section.id
                          ? dragOverSectionOrder.position === "above"
                            ? { boxShadow: "inset 0 2px 0 hsl(var(--primary))" }
                            : { boxShadow: "inset 0 -2px 0 hsl(var(--primary))" }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-3">
                        {group.section ? (
                          <button
                            type="button"
                            draggable={!reordering}
                            onDragStart={(event) => {
                              event.stopPropagation()
                              setDragSectionId(group.section!.id)
                              setDragOverSectionOrder(null)
                            }}
                            onDragEnd={() => { setDragSectionId(null); setDragOverSectionOrder(null) }}
                            className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                            aria-label={`Drag to reorder section ${group.section.name}`}
                          >
                            <GripVertical className="size-4" />
                          </button>
                        ) : null}
                        <h3 className="text-xl font-semibold">{group.section?.name || "Unsectioned"}</h3>
                        {valuationLoading ? (
                          <Skeleton className="h-6 w-24" />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {formatCurrency(group.total, baseCurrency)}
                          </span>
                        )}
                        {group.section && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openSectionEdit(group.section!)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                      </div>
                      {group.assets.length > 0 ? (
                        renderAssetTable(group.assets)
                      ) : (
                        <p className="text-muted-foreground text-sm pl-8">
                          Drop assets here to add them to this section.
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AssetManagementSheet
        asset={selectedAsset}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={loadAssets}
        stakeValue={selectedAsset ? (stakeValuesByAsset.get(selectedAsset.id) ?? null) : null}
        stakeValueNative={(() => {
          if (!selectedAsset) return null
          const sv = stakeValuesByAsset.get(selectedAsset.id) ?? null
          if (sv === null) return null
          const assetCurr = normalizeCurrency(selectedAsset.currencyCode)
          const bc = normalizeCurrency(baseCurrency)
          if (assetCurr === bc) return sv
          const rate = fxRates[assetCurr]
          return rate && rate > 0 ? sv / rate : null
        })()}
        baseCurrency={baseCurrency}
      />
    </div>
  )
}
