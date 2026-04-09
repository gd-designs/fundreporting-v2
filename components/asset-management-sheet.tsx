"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Underline,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UploadDocumentsDialog } from "@/components/upload-documents-dialog";
import { AssetOverviewChart } from "@/components/asset-overview-chart";
import type { EntityAsset } from "@/lib/entity-assets";
import { updateEntityAsset, formatCurrency } from "@/lib/entity-assets";
import {
  fetchEntityTransactions,
  formatAmountWithCurrency,
  formatTxDate,
  isCapitalTransaction,
  type EntityTransaction,
} from "@/lib/entity-transactions";
import { fetchDocuments, fetchDocumentsByShareholder, type EntityDocument } from "@/lib/documents";
import {
  fetchMarketQuote,
  fetchMarketEodSeries,
  emitLiveQuoteUpdated,
  type MarketEodPoint,
} from "@/lib/market";
import { fetchMutations, type Mutation } from "@/lib/mutations";
import { termUnitLabel, frequencyLabel } from "@/lib/liabilities";
import {
  fetchReturnProfiles,
  deleteReturnProfile,
  type ReturnProfile,
} from "@/lib/return-profiles";
import { AddReturnProfileDialog } from "@/components/add-return-profile-dialog";
import { ReturnProfilePeriodTable } from "@/components/return-profile-period-table";
import { DocumentList } from "@/components/document-list";

function formatDateTime(timestamp: number) {
  const d = new Date(timestamp);
  const isMidnight =
    d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  if (isMidnight) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function formatDateOnly(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, (m || 1) - 1, d || 1));
}

function toYmdLocal(timestamp: number) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type TransactionRow = {
  kind: "transaction";
  transactionId: string;
  legId: string;
  legCreatedAt: number | null;
  date: number;
  typeName: string;
  entryType: string;
  entryTypeLabel: string;
  reference: string;
  direction: "in" | "out";
  amount: number;
  currencyCode: string | null;
  proceeds: number | null;
  sourceName: string | null;
  source: string | null;
  sourceId: string | null;
  otherLegs: EntityTransaction["legs"];
};

type MarketRow = {
  kind: "market";
  marketId: string;
  date: number;
  ymd: string;
  dateLabel: string;
  delta: number;
  price: number;
  value: number;
  source: "eod" | "live";
};

type MutationRow = {
  kind: "mutation";
  mutationId: string;
  date: number;
  delta: number;
  source: Mutation["source"];
  notes: string | null;
};

export function AssetManagementSheet({
  asset,
  open,
  onOpenChange,
  onUpdated,
  stakeValue,
  stakeValueNative,
  baseCurrency: baseCurrencyProp,
}: {
  asset: EntityAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
  stakeValue?: number | null;
  stakeValueNative?: number | null;
  baseCurrency?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [transactions, setTransactions] = React.useState<EntityTransaction[]>(
    [],
  );
  const [txLoading, setTxLoading] = React.useState(false);
  const [sourceNameMap, setSourceNameMap] = React.useState<Map<string, string>>(
    new Map(),
  );
  const [mutations, setMutations] = React.useState<Mutation[]>([]);
  const [documents, setDocuments] = React.useState<EntityDocument[]>([]);
  const [docsLoading, setDocsLoading] = React.useState(false);
  const [returnProfiles, setReturnProfiles] = React.useState<ReturnProfile[]>(
    [],
  );
  const [addReturnProfileOpen, setAddReturnProfileOpen] = React.useState(false);
  const [selectedProfileId, setSelectedProfileId] = React.useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = React.useState("overview");

  const [investable, setInvestable] = React.useState<string | null>(null);
  const [taxable, setTaxable] = React.useState<string | null>(null);
  const [savingInvestable, setSavingInvestable] = React.useState(false);
  const [savingTaxable, setSavingTaxable] = React.useState(false);

  const [reportingCurrency, setReportingCurrency] = React.useState<string>("");
  const [reportingCountry, setReportingCountry] = React.useState<string>("");
  const [reportingClass, setReportingClass] = React.useState<string>("");
  const [savingReportingField, setSavingReportingField] = React.useState<
    string | null
  >(null);

  type SimpleOption = { id: number; name: string; code?: string };
  const [currencies, setCurrencies] = React.useState<SimpleOption[]>([]);
  const [countries, setCountries] = React.useState<SimpleOption[]>([]);
  const [assetClassOptions, setAssetClassOptions] = React.useState<
    SimpleOption[]
  >([]);

  const [editingName, setEditingName] = React.useState(false);
  const [nameValue, setNameValue] = React.useState("");
  const [savingName, setSavingName] = React.useState(false);
  const [notesHtml, setNotesHtml] = React.useState("");
  const [notesDirty, setNotesDirty] = React.useState(false);
  const [savingNotes, setSavingNotes] = React.useState(false);

  const [liveQuote, setLiveQuote] = React.useState<number | null>(null);
  const [liveQuoteAsOf, setLiveQuoteAsOf] = React.useState<number | null>(null);
  const [liveQuoteRefreshing, setLiveQuoteRefreshing] = React.useState(false);
  const [eodPoints, setEodPoints] = React.useState<MarketEodPoint[]>([]);
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(
    null,
  );
  const [editingEntryValue, setEditingEntryValue] = React.useState("");

  const notesEditorRef = React.useRef<HTMLDivElement | null>(null);
  const setNotesEditorRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      notesEditorRef.current = node;
      if (node) node.innerHTML = notesHtml;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Fetch reference data once when sheet opens
  React.useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/currencies").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/countries").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/asset-classes").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cur, cou, cls]) => {
        setCurrencies(Array.isArray(cur) ? cur : []);
        setCountries(Array.isArray(cou) ? cou : []);
        setAssetClassOptions(Array.isArray(cls) ? cls : []);
      })
      .catch(() => {});
  }, [open]);

  // Reset state when asset changes
  React.useEffect(() => {
    if (!asset) return;
    setInvestable(asset.investable ?? null);
    setTaxable(asset.taxable ?? null);
    setReportingCurrency(
      asset.currencyId != null ? String(asset.currencyId) : "",
    );
    setReportingCountry(asset.countryId != null ? String(asset.countryId) : "");
    setReportingClass(asset.classId != null ? String(asset.classId) : "");
    setNotesHtml(asset.notes ?? "");
    setNotesDirty(false);
    setLiveQuote(null);
    setLiveQuoteAsOf(null);
    setEodPoints([]);
  }, [asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!notesEditorRef.current) return;
    if (notesEditorRef.current.innerHTML !== notesHtml) {
      notesEditorRef.current.innerHTML = notesHtml;
    }
  }, [notesHtml]);

  // Load transactions + mutations
  const loadLedger = React.useCallback(async () => {
    if (!asset) return;
    setTxLoading(true);
    Promise.all([
      fetchEntityTransactions(asset.entityId),
      fetchMutations(asset.id, asset.entityId),
    ])
      .then(([allTx, allMut]) => {
        const filtered = allTx.filter((tx) =>
          tx.legs.some((l) => l.assetId === asset.id),
        );
        setTransactions(filtered);
        setMutations(allMut);

        // Fetch names for source references (liability + cash; return_profile resolved separately)
        const liabilityIds = Array.from(
          new Set(
            filtered.flatMap((tx) =>
              tx.legs
                .filter((l) => l.source === "liability" && l.sourceId)
                .map((l) => l.sourceId!),
            ),
          ),
        );
        if (liabilityIds.length > 0) {
          Promise.all(
            liabilityIds.map((id) =>
              fetch(`/api/liabilities/${id}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => [id, d?.name ?? id] as [string, string]),
            ),
          )
            .then((entries) =>
              setSourceNameMap((prev) => new Map([...prev, ...entries])),
            )
            .catch(() => {});
        }
        const cashSourceIds = Array.from(
          new Set(
            filtered.flatMap((tx) =>
              tx.legs
                .filter((l) => (l.source === "cash" || l.source === "asset") && l.sourceId)
                .map((l) => l.sourceId!),
            ),
          ),
        );
        if (cashSourceIds.length > 0) {
          Promise.all(
            cashSourceIds.map((id) =>
              fetch(`/api/assets/${id}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => [id, d?.name ?? id] as [string, string]),
            ),
          )
            .then((entries) =>
              setSourceNameMap((prev) => new Map([...prev, ...entries])),
            )
            .catch(() => {});
        }
        const capSourceIds = Array.from(
          new Set(
            filtered.flatMap((tx) =>
              tx.legs
                .filter((l) => l.source === "cap" && l.sourceId)
                .map((l) => l.sourceId!),
            ),
          ),
        );
        if (capSourceIds.length > 0) {
          Promise.all(
            capSourceIds.map((id) =>
              fetch(`/api/cap-table-shareholders/${id}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => [id, d?.name ?? id] as [string, string]),
            ),
          )
            .then((entries) =>
              setSourceNameMap((prev) => new Map([...prev, ...entries])),
            )
            .catch(() => {});
        }
        let netU = 0;
        for (const tx of filtered) {
          for (const leg of tx.legs) {
            if (leg.assetId !== asset.id || leg.units == null) continue;
            netU += leg.direction === "in" ? leg.units : -leg.units;
          }
        }
        const positionClosed = asset.instrument?.ticker ? netU <= 0 : false;
        if (!positionClosed && asset.instrument?.ticker)
          void refreshLiveQuote();
      })
      .catch(() => {
        setTransactions([]);
        setMutations([]);
      })
      .finally(() => setTxLoading(false));
  }, [asset?.id, asset?.entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (open) void loadLedger();
  }, [asset?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load documents — asset's own + shareholder docs (for fund equity stakes)
  const loadDocs = React.useCallback(async () => {
    if (!asset) return;
    setDocsLoading(true);
    try {
      const [entityDocs, shareholderDocs] = await Promise.all([
        fetchDocuments(asset.entityId).catch(() => []),
        asset.capTableShareholder
          ? fetchDocumentsByShareholder(asset.capTableShareholder).catch(() => [])
          : Promise.resolve([] as EntityDocument[]),
      ]);
      const assetDocs = entityDocs.filter(
        (d) => d.objectType === "asset" && d.objectId === asset.id,
      );
      // Merge + dedupe by id (in case any docs appear in both lists)
      const seen = new Set<string>();
      const merged: EntityDocument[] = [];
      for (const d of [...assetDocs, ...shareholderDocs]) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        merged.push(d);
      }
      setDocuments(merged);
    } finally {
      setDocsLoading(false);
    }
  }, [asset?.id, asset?.entityId, asset?.capTableShareholder]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (open) void loadDocs();
  }, [open, loadDocs]);

  // Load return profiles
  const loadReturnProfiles = React.useCallback(async () => {
    if (!asset) return;
    fetchReturnProfiles(asset.id)
      .then(setReturnProfiles)
      .catch(() => setReturnProfiles([]));
  }, [asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (open) void loadReturnProfiles();
  }, [open, loadReturnProfiles]);

  // Resolve return_profile source names from loaded profiles
  React.useEffect(() => {
    if (returnProfiles.length === 0) return;
    const entries: [string, string][] = [];
    for (const tx of transactions) {
      for (const leg of tx.legs) {
        if (leg.source === "return_profile" && leg.sourceId) {
          const profile = returnProfiles.find((p) => p.id === leg.sourceId);
          if (profile?.name) entries.push([leg.sourceId, profile.name]);
        }
      }
    }
    if (entries.length > 0) {
      setSourceNameMap((prev) => new Map([...prev, ...entries]));
    }
  }, [returnProfiles, transactions]);

  // Clock tick for live quote age
  React.useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // Live quote
  const refreshLiveQuote = React.useCallback(async () => {
    const ticker = asset?.instrument?.ticker?.trim();
    if (!asset || !ticker) {
      setLiveQuote(null);
      setLiveQuoteAsOf(null);
      return;
    }
    setLiveQuoteRefreshing(true);
    try {
      const quote = await fetchMarketQuote(ticker);
      if (
        typeof quote.price === "number" &&
        Number.isFinite(quote.price) &&
        quote.price > 0
      ) {
        setLiveQuote(quote.price);
        setLiveQuoteAsOf(typeof quote.asOf === "number" ? quote.asOf : null);
        emitLiveQuoteUpdated({
          ticker,
          price: quote.price,
          asOf: typeof quote.asOf === "number" ? quote.asOf : Date.now(),
        });
        return;
      }
      setLiveQuote(null);
      setLiveQuoteAsOf(null);
    } catch {
      setLiveQuote(null);
      setLiveQuoteAsOf(null);
    } finally {
      setLiveQuoteRefreshing(false);
    }
  }, [asset]);

  // EOD series for chart
  React.useEffect(() => {
    const ticker = asset?.instrument?.ticker?.trim();
    const purchasedAt = asset?.purchasedAt
      ? new Date(asset.purchasedAt).getTime()
      : null;
    if (!open || !asset || !ticker || !purchasedAt) {
      setEodPoints([]);
      return;
    }
    let cancelled = false;
    const loadEod = async () => {
      try {
        const from = purchasedAt - 24 * 60 * 60 * 1000;
        const points = await fetchMarketEodSeries(ticker, from, Date.now());
        if (!cancelled) setEodPoints(points);
      } catch {
        if (!cancelled) setEodPoints([]);
      }
    };
    void loadEod();
    return () => {
      cancelled = true;
    };
  }, [open, asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Balance from transactions + mutations
  const assetBalance = React.useMemo(() => {
    if (!asset) return 0;
    const txBalance = transactions.reduce((sum, tx) => {
      for (const leg of tx.legs) {
        if (leg.assetId !== asset.id) continue;
        sum += leg.direction === "in" ? leg.amount : -leg.amount;
      }
      return sum;
    }, 0);
    const mutationBalance = mutations.reduce((sum, m) => sum + m.delta, 0);
    return txBalance + mutationBalance;
  }, [transactions, mutations, asset]);

  const txInTotal = React.useMemo(() => {
    if (!asset) return 0;
    return transactions.reduce((sum, tx) => {
      if (!isCapitalTransaction(tx)) return sum;
      for (const leg of tx.legs) {
        if (leg.assetId === asset.id && leg.direction === "in")
          sum += leg.amount;
      }
      return sum;
    }, 0);
  }, [transactions, asset]);

  const txOutTotal = React.useMemo(() => {
    if (!asset) return 0;
    return transactions.reduce((sum, tx) => {
      if (!isCapitalTransaction(tx)) return sum;
      for (const leg of tx.legs) {
        if (leg.assetId === asset.id && leg.direction === "out")
          sum += leg.amount;
      }
      return sum;
    }, 0);
  }, [transactions, asset]);

  // For ticker assets "sold" means net units = 0 (allows rebuy).
  // For non-ticker "sold" means any out leg exists.
  const netUnits = React.useMemo(() => {
    if (!asset?.instrument?.ticker) return null;
    let units = 0;
    for (const tx of transactions) {
      for (const leg of tx.legs) {
        if (leg.assetId !== asset.id || leg.units == null) continue;
        units += leg.direction === "in" ? leg.units : -leg.units;
      }
    }
    return units;
  }, [transactions, asset]);

  const isSold =
    txOutTotal > 0 &&
    !(asset?.className?.toLowerCase().includes("cash") ?? false) &&
    (asset?.instrument?.ticker ? (netUnits ?? 0) <= 0 : true);

  const soldAt = React.useMemo(() => {
    if (!asset) return null;
    for (const tx of transactions) {
      if (!isCapitalTransaction(tx)) continue;
      for (const leg of tx.legs) {
        if (leg.assetId === asset.id && leg.direction === "out") return tx.date;
      }
    }
    return null;
  }, [transactions, asset, isSold]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalUnits = React.useMemo(() => {
    if (!asset) return null;
    let units: number | null = null;
    for (const tx of transactions) {
      for (const leg of tx.legs) {
        if (leg.assetId !== asset.id || leg.units == null) continue;
        units =
          (units ?? 0) + (leg.direction === "in" ? leg.units : -leg.units);
      }
    }
    return units;
  }, [transactions, asset]);

  // Live value = price × units (for multi-unit ticker positions)
  const liveNativeValue = React.useMemo(() => {
    if (liveQuote == null) return null;
    return totalUnits != null ? liveQuote * totalUnits : liveQuote;
  }, [liveQuote, totalUnits]);

  // Ledger rows from transaction legs (no balance yet)
  const txRows = React.useMemo((): TransactionRow[] => {
    if (!asset) return [];
    const rows: TransactionRow[] = [];
    for (const tx of transactions) {
      for (const leg of tx.legs) {
        if (leg.assetId !== asset.id) continue;
        rows.push({
          kind: "transaction",
          transactionId: tx.id,
          legId: leg.id,
          legCreatedAt: leg.createdAt,
          date: tx.date,
          typeName: tx.typeName,
          entryType: leg.entryType,
          entryTypeLabel: leg.entryTypeLabel || tx.typeName,
          reference: tx.reference,
          direction: leg.direction,
          amount: leg.amount,
          currencyCode: leg.currencyCode,
          proceeds: leg.proceeds,
          sourceName: leg.objectName,
          source: leg.source,
          sourceId: leg.sourceId,
          otherLegs: tx.legs.filter((l) => l.assetId !== asset.id),
        });
      }
    }
    rows.sort((a, b) => {
      if (a.date !== b.date) return a.date - b.date;
      const ac = a.legCreatedAt ?? 0;
      const bc = b.legCreatedAt ?? 0;
      return ac - bc;
    });
    return rows;
  }, [transactions, asset]);

  // Market rows from EOD + live
  const marketRows = React.useMemo((): MarketRow[] => {
    if (!asset?.instrument?.ticker) return [];
    const purchasedAt = asset.purchasedAt
      ? new Date(asset.purchasedAt).getTime()
      : null;
    if (!purchasedAt) return [];
    const purchaseYmd = toYmdLocal(purchasedAt);
    const todayYmd = toYmdLocal(Date.now());
    const sortedPoints = [...eodPoints]
      .filter((point) => point.date >= purchaseYmd && point.date < todayYmd)
      .sort((a, b) => a.timestamp - b.timestamp);
    const rows: MarketRow[] = [];
    let previousValue = assetBalance;
    for (const point of sortedPoints) {
      const eodValue = point.close * (totalUnits ?? 1);
      const delta = eodValue - previousValue;
      rows.push({
        kind: "market",
        marketId: `eod-${point.date}`,
        date: point.timestamp,
        ymd: point.date,
        dateLabel: formatDateOnly(point.date),
        delta,
        price: point.close,
        value: eodValue,
        source: "eod",
      });
      previousValue = eodValue;
    }
    if (typeof liveQuote === "number" && liveQuote > 0) {
      const liveValue = totalUnits != null ? liveQuote * totalUnits : liveQuote;
      // Delta = intraday price change × units (not position value vs last EOD value,
      // which would conflate price movement with buys/sells)
      const lastEodClose =
        sortedPoints.length > 0
          ? sortedPoints[sortedPoints.length - 1]!.close
          : null;
      const delta =
        lastEodClose != null
          ? (liveQuote - lastEodClose) * (totalUnits ?? 1)
          : liveValue - previousValue;
      rows.push({
        kind: "market",
        marketId: `live-${Date.now()}`,
        date: Date.now(),
        ymd: toYmdLocal(Date.now()),
        dateLabel: formatDateTime(Date.now()),
        delta,
        price: liveQuote,
        value: liveValue,
        source: "live",
      });
    }
    return rows;
  }, [
    asset?.instrument?.ticker,
    assetBalance,
    eodPoints,
    liveQuote,
    liveQuoteAsOf,
    totalUnits,
  ]);

  // Mutation rows
  const mutationRows = React.useMemo(
    (): MutationRow[] =>
      mutations.map((m) => ({
        kind: "mutation" as const,
        mutationId: m.id,
        date: m.date,
        delta: m.delta,
        source: m.source,
        notes: m.notes,
      })),
    [mutations],
  );

  // Merge transaction + market + mutation rows, sorted oldest-first, with running balance
  const ledgerRows = React.useMemo((): (
    | (TransactionRow & { balance: number })
    | (MarketRow & { balance: number })
    | (MutationRow & { balance: number })
  )[] => {
    const merged: (TransactionRow | MarketRow | MutationRow)[] = [
      ...txRows,
      ...marketRows,
      ...mutationRows,
    ];
    merged.sort((a, b) => {
      const aYmd = a.kind === "market" ? a.ymd : toYmdLocal(a.date);
      const bYmd = b.kind === "market" ? b.ymd : toYmdLocal(b.date);
      if (aYmd !== bYmd) return aYmd < bYmd ? -1 : 1;
      // Same calendar day: mutations first, then transactions, then market marks
      const kindOrder = (k: string) =>
        k === "mutation" ? 0 : k === "transaction" ? 1 : 2;
      if (kindOrder(a.kind) !== kindOrder(b.kind))
        return kindOrder(a.kind) - kindOrder(b.kind);
      if (a.kind === "transaction" && b.kind === "transaction") {
        // Sort by user-set transaction date first (logical order)
        if (a.date !== b.date) return a.date - b.date;
        // Same tx.date (same transaction): use DB creation order
        const ac = a.legCreatedAt ?? 0;
        const bc = b.legCreatedAt ?? 0;
        if (ac !== bc) return ac - bc;
        // Same creation time: "in" entries before "out"
        const ad = a.direction === "in" ? 0 : 1;
        const bd = b.direction === "in" ? 0 : 1;
        return ad - bd;
      }
      return a.date - b.date;
    });
    let running = 0;
    return merged.map((row) => {
      if (row.kind === "market") {
        running = row.value;
      } else if (row.kind === "mutation") {
        running += row.delta;
      } else {
        running += row.direction === "in" ? row.amount : -row.amount;
      }
      return { ...row, balance: running };
    });
  }, [txRows, marketRows, mutationRows]);

  // Overview chart data (all rows merged)
  const overviewRows = React.useMemo(
    () =>
      ledgerRows.map((row) => ({
        date: row.date,
        balance: row.balance,
        label:
          row.kind === "market"
            ? row.source === "live"
              ? "Today · Live"
              : `${formatTxDate(row.date)} · EOD`
            : row.kind === "mutation"
              ? `${formatTxDate(row.date)} · Revaluation`
              : `${formatTxDate(row.date)} · ${row.typeName}`,
        realizedGain:
          row.kind === "transaction" && row.proceeds != null
            ? row.proceeds - row.amount
            : null,
      })),
    [ledgerRows],
  );

  const showSourceCol = React.useMemo(
    () => ledgerRows.some((r) => r.kind === "transaction" && r.source),
    [ledgerRows],
  );

  const liveAgeLabel = React.useMemo(() => {
    if (!liveQuoteAsOf) return null;
    const diffSec = Math.max(0, Math.floor((nowMs - liveQuoteAsOf) / 1000));
    if (diffSec < 5) return "just refreshed";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
  }, [liveQuoteAsOf, nowMs]);

  async function saveName() {
    if (!asset || !nameValue.trim() || nameValue.trim() === asset.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateEntityAsset(asset.id, { name: nameValue.trim() });
      onUpdated?.();
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  }

  async function saveInvestable(value: string) {
    if (!asset) return;
    setSavingInvestable(true);
    setInvestable(value);
    try {
      await updateEntityAsset(asset.id, { investable: value || null });
      onUpdated?.();
    } finally {
      setSavingInvestable(false);
    }
  }

  async function saveTaxable(value: string) {
    if (!asset) return;
    setSavingTaxable(true);
    setTaxable(value);
    try {
      await updateEntityAsset(asset.id, { taxable: value || null });
      onUpdated?.();
    } finally {
      setSavingTaxable(false);
    }
  }

  async function saveReportingField(
    field: string,
    value: string,
    setter: (v: string) => void,
  ) {
    if (!asset) return;
    setter(value);
    setSavingReportingField(field);
    try {
      await updateEntityAsset(asset.id, {
        [field]: value ? Number(value) : null,
      });
      onUpdated?.();
    } finally {
      setSavingReportingField(null);
    }
  }

  const execRichText = React.useCallback((command: string) => {
    if (!notesEditorRef.current) return;
    notesEditorRef.current.focus();
    document.execCommand(command);
    const html = notesEditorRef.current.innerHTML;
    setNotesHtml(html);
    setNotesDirty(true);
  }, []);

  const saveNotes = React.useCallback(async () => {
    if (!asset || savingNotes || !notesDirty) return;
    setSavingNotes(true);
    try {
      await updateEntityAsset(asset.id, { notes: notesHtml });
      setNotesDirty(false);
      onUpdated?.();
    } finally {
      setSavingNotes(false);
    }
  }, [asset, notesDirty, notesHtml, savingNotes, onUpdated]);

  const deleteTransaction = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setDeleteError(payload.message ?? "Failed to delete transaction.");
      } else {
        setTransactions((prev) => prev.filter((tx) => tx.id !== id));
        onUpdated?.();
      }
    } catch {
      setDeleteError("Failed to delete transaction.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleEntryAmountCommit = async (legId: string) => {
    const parsed = parseFloat(editingEntryValue);
    if (!isFinite(parsed) || parsed <= 0) {
      setEditingEntryId(null);
      return;
    }
    try {
      const res = await fetch(`/api/transaction-entries/${legId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });
      if (res.ok) onUpdated?.();
    } catch {
      // silently revert
    } finally {
      setEditingEntryId(null);
    }
  };

  if (!asset) return null;

  const currentValue = assetBalance;
  const hasInstrument = !!asset.instrument?.ticker;
  const isCashAsset = asset.className?.toLowerCase().includes("cash") ?? false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto w-[90vw]! p-0">
        <div className="flex flex-col">
          <SheetHeader className="shrink-0 px-4 pt-4">
            {editingName ? (
              <SheetTitle>
                <input
                  autoFocus
                  className="w-full bg-transparent border-b border-foreground outline-none text-xl font-semibold"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  disabled={savingName}
                />
              </SheetTitle>
            ) : (
              <SheetTitle
                className="cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => {
                  setNameValue(asset.name || "");
                  setEditingName(true);
                }}
              >
                {asset.name || "Unnamed asset"}
              </SheetTitle>
            )}
            <SheetDescription>Manage this asset record.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 px-4 pb-4">
            {/* Summary grid */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Class</p>
                <p className="mt-1 text-sm font-medium">
                  {asset.className || "—"}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Country</p>
                <p className="mt-1 text-sm font-medium">
                  {asset.countryLabel || "—"}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Currency</p>
                <p className="mt-1 text-sm font-medium">
                  {asset.currencyLabel || asset.currencyCode || "—"}
                </p>
              </div>
            </div>

            {/* Shareholder card — shown when asset is linked to a cap table shareholder */}
            {asset.shareholder && (
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Shareholder</p>
                <p className="mt-1 text-sm font-medium">{asset.shareholder.name || "—"}</p>
                <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 text-xs">
                  {asset.shareholder.entityName && (
                    <span>{asset.shareholder.entityName}</span>
                  )}
                  {asset.shareholder.email && (
                    <span>{asset.shareholder.email}</span>
                  )}
                  {asset.shareholder.role && (
                    <span className="capitalize">{asset.shareholder.role.replace(/_/g, " ")}</span>
                  )}
                </div>
              </div>
            )}

            <div
              className={`grid gap-3 ${isCashAsset ? "md:grid-cols-2" : "md:grid-cols-4"}`}
            >
              {/* Amount paid — hidden for cash */}
              {!isCashAsset && (
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground text-xs">
                    Net capital deployed
                  </p>
                  {txLoading ? (
                    <Skeleton className="mt-1 h-5 w-24" />
                  ) : (
                    <p className="mt-1 text-sm font-medium">
                      {formatCurrency(
                        txInTotal - txOutTotal || assetBalance,
                        asset.currencyCode,
                      )}
                    </p>
                  )}
                  {(() => {
                    const buyTxs = transactions
                      .filter((tx) =>
                        tx.legs.some(
                          (l) => l.assetId === asset.id && l.direction === "in",
                        ),
                      )
                      .map((tx) => tx.date)
                      .sort((a, b) => b - a);
                    if (buyTxs.length === 0) return null;
                    const date = buyTxs[0]!;
                    const label = buyTxs.length > 1 ? "Last bought" : "Bought";
                    const formatted = asset.instrument?.ticker
                      ? formatDateTime(date)
                      : formatDateOnly(toYmdLocal(date));
                    return (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {label} @ {formatted}
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* Quantity — hidden for cash */}
              {!isCashAsset && (
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground text-xs">{asset.shareholder ? "Shares" : "Quantity"}</p>
                  {txLoading ? (
                    <Skeleton className="mt-1 h-5 w-16" />
                  ) : (
                    <p className="mt-1 text-sm font-medium">
                      {totalUnits != null
                        ? new Intl.NumberFormat("en-US", {
                            maximumFractionDigits: 6,
                          }).format(totalUnits)
                        : "—"}
                    </p>
                  )}
                </div>
              )}

              {/* Value or Sold for */}
              {isSold ? (
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground text-xs">Sold for</p>
                  {txLoading ? (
                    <Skeleton className="mt-1 h-5 w-24" />
                  ) : (
                    <p className="mt-1 text-sm font-medium">
                      {formatCurrency(txOutTotal, asset.currencyCode)}
                    </p>
                  )}
                  {soldAt && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Sold @ {formatDateTime(soldAt)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">Value</p>
                    {hasInstrument && !stakeValue && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => void refreshLiveQuote()}
                        disabled={liveQuoteRefreshing}
                        aria-label="Refresh live price"
                      >
                        <RefreshCw
                          className={`size-3.5 ${liveQuoteRefreshing ? "animate-spin" : ""}`}
                        />
                      </Button>
                    )}
                  </div>
                  {txLoading ? (
                    <Skeleton className="mt-1 h-5 w-24" />
                  ) : stakeValue != null ? (
                    <p className="mt-1 text-sm font-medium">
                      {formatCurrency(stakeValue, baseCurrencyProp ?? asset.currencyCode)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium">
                      {formatCurrency(
                        liveNativeValue ?? currentValue,
                        asset.currencyCode,
                      )}
                    </p>
                  )}
                  {stakeValue != null ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {stakeValueNative != null && baseCurrencyProp && baseCurrencyProp.toUpperCase() !== asset.currencyCode.toUpperCase()
                        ? `${formatCurrency(stakeValueNative, asset.currencyCode)} · NAV · live`
                        : "NAV · live"}
                    </p>
                  ) : liveQuote != null ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Live {formatCurrency(liveQuote, asset.currencyCode)}/unit
                      {liveAgeLabel ? ` · ${liveAgeLabel}` : ""}
                    </p>
                  ) : null}
                </div>
              )}

              {/* Growth / Gain-Loss or Sold badge */}
              {isSold
                ? (() => {
                    const gainLoss = txOutTotal - txInTotal;
                    const gainLossPct =
                      txInTotal !== 0 ? (gainLoss / txInTotal) * 100 : 0;
                    const isUp = gainLoss >= 0;
                    return (
                      <div className="rounded-md border p-3">
                        <div className="flex items-center gap-1.5">
                          <p className="text-muted-foreground text-xs">
                            Gain / Loss
                          </p>
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                            Sold
                          </span>
                        </div>
                        {txLoading ? (
                          <Skeleton className="mt-1 h-5 w-24" />
                        ) : (
                          <p
                            className={`mt-1 text-sm font-medium ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}
                          >
                            {isUp ? "+" : "−"}
                            {formatCurrency(
                              Math.abs(gainLoss),
                              asset.currencyCode,
                            )}
                          </p>
                        )}
                        <p
                          className={`mt-1 text-xs ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}
                        >
                          {gainLossPct >= 0 ? "+" : ""}
                          {gainLossPct.toFixed(2)}%
                        </p>
                      </div>
                    );
                  })()
                : (() => {
                    if (isCashAsset) {
                      return (
                        <div className="rounded-md border p-3">
                          <p className="text-muted-foreground text-xs">
                            Growth / Gain-Loss
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            —
                          </p>
                        </div>
                      );
                    }
                    // currentValue (assetBalance) includes mutations — correct for non-market assets.
                    // For market assets, prefer live quote. Compare against net cost (buys minus sells).
                    // For equity stakes, use native stake value so G/L is in the asset's own currency.
                    const effectiveStake = stakeValueNative ?? stakeValue;
                    const liveValue = effectiveStake != null ? effectiveStake : (liveNativeValue ?? currentValue);
                    const glCurrency = asset.currencyCode;
                    const netCost = txInTotal - txOutTotal || currentValue;
                    const gainLoss = liveValue - netCost;
                    const gainLossPct =
                      netCost !== 0 ? (gainLoss / netCost) * 100 : 0;
                    const isUp = gainLoss >= 0;
                    return (
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground text-xs">
                          Growth / Gain-Loss
                        </p>
                        {txLoading ? (
                          <Skeleton className="mt-1 h-5 w-24" />
                        ) : (
                          <p
                            className={`mt-1 text-sm font-medium ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}
                          >
                            {isUp ? "+" : "−"}
                            {formatCurrency(
                              Math.abs(gainLoss),
                              glCurrency,
                            )}
                          </p>
                        )}
                        <p
                          className={`mt-1 text-xs ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}
                        >
                          {gainLossPct >= 0 ? "+" : ""}
                          {gainLossPct.toFixed(2)}%
                        </p>
                      </div>
                    );
                  })()}
            </div>

            {/* Instrument info */}
            {asset.instrument && (
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs mb-2">Instrument</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">
                      {asset.instrument.name || asset.instrument.ticker}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {asset.instrument.ticker} · {asset.instrument.exchange}
                    </p>
                  </div>
                  <span className="text-xs rounded-md border px-2 py-0.5">
                    {asset.instrument.type}
                  </span>
                </div>
              </div>
            )}

            {/* Liability cards */}
            {asset.liabilities.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  {asset.liabilities.length === 1
                    ? "Liability"
                    : `Liabilities (${asset.liabilities.length})`}
                </p>
                {asset.liabilities.map((lib) => (
                  <div
                    key={lib.id}
                    className="rounded-md border p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => {
                      const basePath = pathname
                        .split("/")
                        .slice(0, -1)
                        .join("/");
                      router.push(
                        `${basePath}/liabilities?liability=${lib.id}`,
                      );
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {lib.name || "Unnamed liability"}
                        </p>
                        {lib.reference && (
                          <p className="text-xs text-muted-foreground">
                            {lib.reference}
                          </p>
                        )}
                      </div>
                      {lib.scheme && (
                        <span className="shrink-0 text-xs rounded-md border px-2 py-0.5 capitalize">
                          {lib.scheme}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {lib.loan_amount != null && (
                        <div>
                          <p className="text-muted-foreground">Loan amount</p>
                          <p className="font-medium text-red-500">
                            {Intl.NumberFormat("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            }).format(lib.loan_amount)}
                          </p>
                        </div>
                      )}
                      {lib.interest_rate != null && (
                        <div>
                          <p className="text-muted-foreground">Interest rate</p>
                          <p className="font-medium">{lib.interest_rate}%</p>
                        </div>
                      )}
                      {lib.term_length != null && (
                        <div>
                          <p className="text-muted-foreground">Term</p>
                          <p className="font-medium">
                            {lib.term_length}{" "}
                            {lib.frequency
                              ? termUnitLabel(lib.frequency)
                              : "periods"}
                          </p>
                        </div>
                      )}
                      {lib.frequency && (
                        <div>
                          <p className="text-muted-foreground">Frequency</p>
                          <p className="font-medium">
                            {frequencyLabel(lib.frequency)}
                          </p>
                        </div>
                      )}
                      {lib.date != null && (
                        <div>
                          <p className="text-muted-foreground">Start date</p>
                          <p className="font-medium">
                            {new Intl.DateTimeFormat("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(new Date(lib.date))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 pb-4">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full"
            >
              <TabsList className="w-full justify-start gap-1 overflow-x-auto whitespace-nowrap">
                <TabsTrigger className="px-3" value="overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger className="px-3" value="ledger">
                  Ledger
                </TabsTrigger>
                <TabsTrigger className="px-3" value="returns">
                  Returns
                </TabsTrigger>
                <TabsTrigger className="px-3" value="reporting">
                  Reporting
                </TabsTrigger>
                <TabsTrigger className="px-3" value="notes">
                  Notes
                </TabsTrigger>
                <TabsTrigger className="px-3" value="documents">
                  Documents
                  {documents.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                      {documents.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent
                value="overview"
                className="mt-4 flex flex-col gap-4 text-sm"
              >
                {asset.description && (
                  <p className="text-muted-foreground">{asset.description}</p>
                )}
                <div className="rounded-md border p-4">
                  <p className="text-muted-foreground mb-4 text-xs uppercase tracking-wide">
                    Balance over time
                  </p>
                  <AssetOverviewChart rows={overviewRows} />
                </div>
              </TabsContent>

              {/* Ledger */}
              <TabsContent value="ledger" className="mt-4 text-sm">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    Transaction and revaluation history for this asset.
                  </p>
                </div>
                {deleteError && (
                  <p className="text-destructive mb-3 text-xs">{deleteError}</p>
                )}
                {txLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : ledgerRows.length === 0 ? (
                  <p className="text-muted-foreground rounded-md border p-4">
                    No transactions recorded for this asset yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-160 text-left text-sm">
                      <thead className="text-muted-foreground border-b">
                        <tr>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Reference</th>
                          <th className="px-3 py-2 font-medium">Amount</th>
                          <th className="px-3 py-2 font-medium">Gain / Loss</th>
                          {showSourceCol && (
                            <th className="px-3 py-2 font-medium">Source / Target</th>
                          )}
                          <th className="px-3 py-2 font-medium text-right">
                            Balance
                          </th>
                          <th className="px-3 py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerRows
                          .slice()
                          .reverse()
                          .map((row) => {
                            if (row.kind === "mutation") {
                              const isUp = row.delta >= 0;
                              return (
                                <tr
                                  key={`mutation-${row.mutationId}`}
                                  className="border-b last:border-b-0 bg-violet-50/40 dark:bg-violet-950/20"
                                >
                                  <td className="px-3 py-2 tabular-nums">
                                    {formatDateTime(row.date)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="rounded px-1.5 py-0.5 text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                      Revaluation
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {row.notes || "—"}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums">
                                    <span
                                      className={
                                        isUp
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-rose-500 dark:text-rose-400"
                                      }
                                    >
                                      {isUp ? "+" : "−"}
                                      {formatAmountWithCurrency(
                                        Math.abs(row.delta),
                                        asset.currencyCode ?? null,
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="flex items-center gap-1 tabular-nums">
                                      {isUp ? (
                                        <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                      ) : (
                                        <TrendingDown className="size-3.5 text-rose-500 dark:text-rose-400" />
                                      )}
                                      <span
                                        className={
                                          isUp
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-rose-500 dark:text-rose-400"
                                        }
                                      >
                                        {isUp ? "+" : "−"}
                                        {formatAmountWithCurrency(
                                          Math.abs(row.delta),
                                          asset.currencyCode ?? null,
                                        )}
                                      </span>
                                    </span>
                                  </td>
                                  {showSourceCol && (
                                    <td className="px-3 py-2 text-muted-foreground">
                                      —
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                                    {formatAmountWithCurrency(
                                      row.balance,
                                      asset.currencyCode ?? null,
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    —
                                  </td>
                                </tr>
                              );
                            }
                            if (row.kind === "market") {
                              const isUp = row.delta >= 0;
                              return (
                                <tr
                                  key={`market-${row.marketId}`}
                                  className="border-b last:border-b-0 bg-sky-50/40 dark:bg-sky-950/20"
                                >
                                  <td className="px-3 py-2 tabular-nums">
                                    {row.dateLabel}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="rounded px-1.5 py-0.5 text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                                      {row.source === "live"
                                        ? "Live mark"
                                        : "EOD mark"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {row.source === "live"
                                      ? "Live market price"
                                      : "End-of-day market price"}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums">
                                    {formatAmountWithCurrency(
                                      row.value,
                                      asset.currencyCode ?? null,
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="flex items-center gap-1 tabular-nums">
                                      {row.source === "live" &&
                                      Math.abs(row.delta) < 0.005 ? (
                                        <span className="text-amber-500">
                                          ~{" "}
                                          {formatAmountWithCurrency(
                                            0,
                                            asset.currencyCode ?? null,
                                          )}
                                        </span>
                                      ) : isUp ? (
                                        <>
                                          <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                          <span className="text-emerald-600 dark:text-emerald-400">
                                            +
                                            {formatAmountWithCurrency(
                                              Math.abs(row.delta),
                                              asset.currencyCode ?? null,
                                            )}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <TrendingDown className="size-3.5 text-rose-500 dark:text-rose-400" />
                                          <span className="text-rose-500 dark:text-rose-400">
                                            −
                                            {formatAmountWithCurrency(
                                              Math.abs(row.delta),
                                              asset.currencyCode ?? null,
                                            )}
                                          </span>
                                        </>
                                      )}
                                    </span>
                                  </td>
                                  {showSourceCol && (
                                    <td className="px-3 py-2 text-muted-foreground">
                                      —
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                                    {formatAmountWithCurrency(
                                      row.balance,
                                      asset.currencyCode ?? null,
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    —
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <tr
                                key={`${row.transactionId}-${row.legId}`}
                                className="border-b last:border-b-0"
                              >
                                <td className="px-3 py-2 tabular-nums">
                                  {formatDateTime(row.date)}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                                    {row.entryTypeLabel}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {row.reference || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  {editingEntryId === row.legId ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      autoFocus
                                      value={editingEntryValue}
                                      onChange={(e) =>
                                        setEditingEntryValue(e.target.value)
                                      }
                                      onBlur={() =>
                                        void handleEntryAmountCommit(row.legId)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          void handleEntryAmountCommit(
                                            row.legId,
                                          );
                                        if (e.key === "Escape")
                                          setEditingEntryId(null);
                                      }}
                                      className="w-28 rounded border border-input bg-background px-2 py-0.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      title="Click to edit"
                                      onClick={() => {
                                        setEditingEntryId(row.legId);
                                        setEditingEntryValue(
                                          String(row.amount),
                                        );
                                      }}
                                      className="flex items-center gap-1 tabular-nums cursor-text hover:underline"
                                    >
                                      {row.direction === "in" ? (
                                        <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                      ) : (
                                        <ArrowUpRight className="size-3.5 text-rose-500 dark:text-rose-400" />
                                      )}
                                      <span
                                        className={
                                          row.direction === "in"
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-rose-500 dark:text-rose-400"
                                        }
                                      >
                                        {row.direction === "in" ? "+" : "−"}
                                        {formatAmountWithCurrency(
                                          row.amount,
                                          row.currencyCode,
                                        )}
                                      </span>
                                    </button>
                                  )}
                                </td>
                                <td className="px-3 py-2 tabular-nums font-medium">
                                  {(() => {
                                    // Non-ticker sell with proceeds field
                                    if (row.proceeds != null) {
                                      const gain = row.proceeds - row.amount;
                                      return (
                                        <span
                                          className={
                                            gain >= 0
                                              ? "text-emerald-600 dark:text-emerald-400"
                                              : "text-rose-500 dark:text-rose-400"
                                          }
                                        >
                                          {gain >= 0 ? "+" : "−"}
                                          {formatAmountWithCurrency(
                                            Math.abs(gain),
                                            row.currencyCode,
                                          )}
                                        </span>
                                      );
                                    }
                                    // Ticker sell: gain vs cost basis at point of sale
                                    // (exclude this tx and any transactions after it)
                                    if (
                                      row.direction === "out" &&
                                      asset?.instrument?.ticker
                                    ) {
                                      let priorIn = 0;
                                      let priorOut = 0;
                                      for (const tx of transactions) {
                                        if (
                                          tx.id === row.transactionId ||
                                          tx.date > row.date
                                        )
                                          continue;
                                        for (const leg of tx.legs) {
                                          if (leg.assetId !== asset.id)
                                            continue;
                                          if (leg.direction === "in")
                                            priorIn += leg.amount;
                                          else priorOut += leg.amount;
                                        }
                                      }
                                      const costAtSell = priorIn - priorOut;
                                      const gain = row.amount - costAtSell;
                                      const pct =
                                        costAtSell !== 0
                                          ? (gain / costAtSell) * 100
                                          : 0;
                                      return (
                                        <span
                                          className={
                                            gain >= 0
                                              ? "text-emerald-600 dark:text-emerald-400"
                                              : "text-rose-500 dark:text-rose-400"
                                          }
                                        >
                                          {gain >= 0 ? "+" : "−"}
                                          {formatAmountWithCurrency(
                                            Math.abs(gain),
                                            row.currencyCode,
                                          )}
                                          <span className="ml-1 text-xs opacity-75">
                                            ({pct >= 0 ? "+" : ""}
                                            {pct.toFixed(2)}%)
                                          </span>
                                        </span>
                                      );
                                    }
                                    return "—";
                                  })()}
                                </td>
                                {showSourceCol && (
                                  <td className="px-3 py-2">
                                    {row.source && row.sourceId ? (
                                      <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const base = pathname
                                                  .split("/")
                                                  .slice(0, -1)
                                                  .join("/");
                                                if (row.source === "return_profile") {
                                                  setSelectedProfileId(row.sourceId);
                                                  setActiveTab("returns");
                                                } else if (row.source === "cash" || row.source === "asset") {
                                                  router.push(`${base}/assets?asset=${row.sourceId}`);
                                                } else {
                                                  router.push(`${base}/liabilities?liability=${row.sourceId}`);
                                                }
                                              }}
                                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                                            >
                                              {row.source.replace(/_/g, " ")}
                                            </button>
                                          </TooltipTrigger>
                                          {sourceNameMap.get(row.sourceId) && (
                                            <TooltipContent side="top">
                                              {sourceNameMap.get(row.sourceId)}
                                            </TooltipContent>
                                          )}
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : row.source ? (
                                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                                        {row.source.replace(/_/g, " ")}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                )}
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {formatAmountWithCurrency(
                                    row.balance,
                                    asset.currencyCode ?? null,
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {confirmDeleteId === row.transactionId ? (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-6 px-2 text-xs"
                                        disabled={
                                          deletingId === row.transactionId
                                        }
                                        onClick={() =>
                                          void deleteTransaction(
                                            row.transactionId,
                                          )
                                        }
                                      >
                                        {deletingId === row.transactionId
                                          ? "Deleting…"
                                          : "Confirm"}
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
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-muted-foreground hover:text-destructive h-6 w-6 p-0"
                                      onClick={() =>
                                        setConfirmDeleteId(row.transactionId)
                                      }
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* Returns */}
              <TabsContent value="returns" className="mt-4 text-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">Return Profiles</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Define how this asset generates income or growth over
                      time.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddReturnProfileOpen(true)}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add return profile
                  </Button>
                </div>

                {returnProfiles.length === 0 ? (
                  <div className="rounded-md border border-dashed py-10 text-center text-muted-foreground text-xs">
                    No return profiles yet. Add one to define payout or
                    compounding behaviour.
                  </div>
                ) : (
                  <>
                    {/* Profile selector cards */}
                    <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
                      {returnProfiles.map((p) => {
                        const isSelected =
                          (selectedProfileId ?? returnProfiles[0]?.id) === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedProfileId(p.id)}
                            className={`flex flex-col items-start rounded-md border px-3 py-2.5 text-xs text-left shrink-0 min-w-35 transition-colors ${
                              isSelected
                                ? "border-foreground bg-muted font-medium"
                                : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            <span className="font-semibold truncate max-w-40">
                              {p.name ?? "Unnamed profile"}
                            </span>
                            <span className="text-muted-foreground capitalize mt-0.5">
                              {p.type === "cash_flow"
                                ? "Cash Flow (Income)"
                                : p.type === "compounding"
                                  ? "Compounding (Growth)"
                                  : (p.type ?? "—")}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Period table for selected profile */}
                    {(() => {
                      const active = returnProfiles.find(
                        (p) =>
                          p.id === (selectedProfileId ?? returnProfiles[0]?.id),
                      );
                      if (!active || !asset) return null;
                      return (
                        <ReturnProfilePeriodTable
                          key={active.id}
                          profile={active}
                          assetId={asset.id}
                          assetName={asset.name ?? "Asset"}
                          entityId={asset.entityId}
                          currencyId={asset.currencyId}
                          currencyCode={asset.currencyCode}
                          assetValue={assetBalance}
                          onLedgerChanged={loadLedger}
                        />
                      );
                    })()}
                  </>
                )}

                {asset && (
                  <AddReturnProfileDialog
                    open={addReturnProfileOpen}
                    onOpenChange={setAddReturnProfileOpen}
                    assetId={asset.id}
                    assetCurrencyId={asset.currencyId}
                    onCreated={(profile) => {
                      setReturnProfiles((prev) => [...prev, profile]);
                      setSelectedProfileId(profile.id);
                    }}
                  />
                )}
              </TabsContent>

              {/* Reporting */}
              <TabsContent value="reporting" className="mt-4 space-y-6">
                {asset?.instrument && (
                  <p className="text-xs text-muted-foreground rounded-md border px-3 py-2">
                    Currency, country, and asset class are managed by the linked
                    instrument ({asset.instrument.ticker}).
                  </p>
                )}

                {/* Investable */}
                <div className="rounded-md border p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      Investable asset?
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Investable assets are those held in cash or in forms that
                      can be quickly liquidated.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { value: "investable_cash", label: "Investable – Cash" },
                      {
                        value: "investable_convert",
                        label: "Investable – Easy to convert to cash",
                      },
                      { value: "non_investable", label: "Non Investable" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="investable"
                          value={opt.value}
                          checked={investable === opt.value}
                          onChange={() => saveInvestable(opt.value)}
                          disabled={savingInvestable || !!asset?.locked}
                          className="accent-foreground size-3.5"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {savingInvestable && (
                    <RefreshCw className="size-3 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Asset class */}
                <div className="rounded-md border p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      Asset class
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shows on the Assets × Class Recap report.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={reportingClass}
                      onValueChange={(v) =>
                        saveReportingField("asset_class", v, setReportingClass)
                      }
                      disabled={
                        savingReportingField === "asset_class" ||
                        !!asset?.instrument ||
                        !!asset?.locked
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Select class…" />
                      </SelectTrigger>
                      <SelectContent>
                        {assetClassOptions.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savingReportingField === "asset_class" && (
                      <RefreshCw className="size-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Currency + Country */}
                <div className="rounded-md border p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Currency &amp; Country
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Currency
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={reportingCurrency}
                          onValueChange={(v) =>
                            saveReportingField(
                              "currency",
                              v,
                              setReportingCurrency,
                            )
                          }
                          disabled={
                            savingReportingField === "currency" ||
                            !!asset?.instrument ||
                            !!asset?.locked
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.code} — {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {savingReportingField === "currency" && (
                          <RefreshCw className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Country
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={reportingCountry}
                          onValueChange={(v) =>
                            saveReportingField(
                              "country",
                              v,
                              setReportingCountry,
                            )
                          }
                          disabled={
                            savingReportingField === "country" ||
                            !!asset?.instrument
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {savingReportingField === "country" && (
                          <RefreshCw className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Taxable */}
                <div className="rounded-md border p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      Taxable asset?
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Will this asset be subject to taxes on liquidation or
                      sale?
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { value: "taxable", label: "Taxable" },
                      { value: "tax_deferred", label: "Tax Deferred" },
                      { value: "tax_free", label: "Tax Free" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="taxable"
                          value={opt.value}
                          checked={taxable === opt.value}
                          onChange={() => saveTaxable(opt.value)}
                          disabled={savingTaxable}
                          className="accent-foreground size-3.5"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {savingTaxable && (
                    <RefreshCw className="size-3 animate-spin text-muted-foreground" />
                  )}
                </div>
              </TabsContent>

              {/* Notes */}
              <TabsContent value="notes" className="mt-4 space-y-3">
                <div className="flex items-center gap-1 rounded-md border p-1 w-fit">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            execRichText("bold");
                          }}
                          className="rounded p-1.5 hover:bg-muted"
                          aria-label="Bold"
                        >
                          <Bold className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Bold</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            execRichText("italic");
                          }}
                          className="rounded p-1.5 hover:bg-muted"
                          aria-label="Italic"
                        >
                          <Italic className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Italic
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            execRichText("underline");
                          }}
                          className="rounded p-1.5 hover:bg-muted"
                          aria-label="Underline"
                        >
                          <Underline className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Underline
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            execRichText("insertUnorderedList");
                          }}
                          className="rounded p-1.5 hover:bg-muted"
                          aria-label="Bullet list"
                        >
                          <List className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Bullet list
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            execRichText("insertOrderedList");
                          }}
                          className="rounded p-1.5 hover:bg-muted"
                          aria-label="Numbered list"
                        >
                          <ListOrdered className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Numbered list
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div
                  ref={setNotesEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const html = e.currentTarget.innerHTML;
                    setNotesHtml(html);
                    setNotesDirty(true);
                  }}
                  className="min-h-48 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none"
                />

                <div className="flex justify-end gap-2">
                  {notesDirty && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNotesHtml(asset.notes ?? "");
                        setNotesDirty(false);
                        if (notesEditorRef.current) {
                          notesEditorRef.current.innerHTML = asset.notes ?? "";
                        }
                      }}
                    >
                      Discard
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={!notesDirty || savingNotes}
                    onClick={saveNotes}
                  >
                    {savingNotes ? "Saving…" : "Save notes"}
                  </Button>
                </div>
              </TabsContent>

              {/* Documents */}
              <TabsContent value="documents">
                <div className="flex items-center justify-between mb-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    {documents.length} document
                    {documents.length !== 1 ? "s" : ""}
                  </p>
                  <UploadDocumentsDialog
                    entityId={asset.entityId}
                    objectType="asset"
                    objectId={asset.id}
                    onUploaded={loadDocs}
                  >
                    <Button size="sm" variant="outline">
                      <Paperclip className="size-3.5 mr-1" />
                      Attach
                    </Button>
                  </UploadDocumentsDialog>
                </div>

                {docsLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No documents attached.
                  </p>
                ) : (
                  <DocumentList documents={documents} onUpdated={loadDocs} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
