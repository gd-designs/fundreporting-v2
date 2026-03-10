"use client";

import * as React from "react";
import {
  Maximize2,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Paperclip,
  PlusCircle,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  termUnitLabel,
  frequencyLabel,
  type Liability,
} from "@/lib/liabilities";
import {
  formatAmountWithCurrency,
  formatTxDate,
  mapRawEntriesToTransactions,
  type EntityTransaction,
} from "@/lib/entity-transactions";
import { fetchDocuments, type EntityDocument } from "@/lib/documents";
import { DocumentList } from "@/components/document-list";
import { UploadDocumentsDialog } from "@/components/upload-documents-dialog";
import {
  computeAll,
  fmtNum,
  type Period,
  type PaymentScheme,
} from "@/lib/amortization";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function schemeMeta(scheme: PaymentScheme) {
  if (scheme === "linear")
    return {
      label: "Linear",
      description: "Equal principal repayments, decreasing interest",
    };
  if (scheme === "bullet")
    return {
      label: "Bullet",
      description: "Interest-only payments, full principal at maturity",
    };
  return {
    label: "Annuity",
    description: "Fixed equal payments throughout the term",
  };
}

// ── Amortization full-table dialog ────────────────────────────────────────────

function FullScheduleDialog({
  scheme,
  periods,
  open,
  onClose,
}: {
  scheme: PaymentScheme;
  periods: Period[];
  open: boolean;
  onClose: () => void;
}) {
  const { label } = schemeMeta(scheme);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{label} — Full amortization schedule</DialogTitle>
          <DialogDescription>
            Breakdown of all {periods.length} payment periods.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 bg-background border-b text-muted-foreground">
              <tr>
                {[
                  "#",
                  "Opening",
                  "Payment",
                  "Interest",
                  "Principal",
                  "Closing",
                ].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 font-medium ${h !== "#" ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.period} className="border-b last:border-0">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {p.period}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {fmtNum(p.opening)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right font-medium">
                    {fmtNum(p.payment)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-rose-500">
                    {fmtNum(p.interest)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {fmtNum(p.principal)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {fmtNum(p.closing)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Scheme card ───────────────────────────────────────────────────────────────

function SchemeCard({
  scheme,
  periods,
  active,
  onExpand,
}: {
  scheme: PaymentScheme;
  periods: Period[];
  active: boolean;
  onExpand: () => void;
}) {
  const { label, description } = schemeMeta(scheme);
  const totalPayment = periods.reduce((s, p) => s + p.payment, 0);
  const totalInterest = periods.reduce((s, p) => s + p.interest, 0);
  const lastPayment = periods[periods.length - 1]?.payment ?? 0;

  return (
    <div
      className={`relative rounded-lg border p-4 ${active ? "border-primary bg-primary/5" : "border-border"}`}
    >
      <button
        type="button"
        title="View full schedule"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded"
        onClick={onExpand}
      >
        <Maximize2 className="size-3.5" />
      </button>
      <div className="flex items-center gap-2 mb-0.5">
        <p className="font-semibold text-sm">{label}</p>
        {active && (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary rounded px-1.5 py-0.5">
            Selected
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Total cost</p>
          <p className="font-medium tabular-nums">{fmtNum(totalPayment)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total interest</p>
          <p className="font-medium tabular-nums text-rose-500">
            {fmtNum(totalInterest)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">
            {scheme === "bullet" ? "Final payment" : "Last payment"}
          </p>
          <p className="font-medium tabular-nums">{fmtNum(lastPayment)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Record payment dialog ─────────────────────────────────────────────────────

function RecordPaymentDialog({
  period,
  liability,
  onClose,
  onSuccess,
}: {
  period: Period;
  liability: Liability;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = React.useState(today);
  const [reference, setReference] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: liability.entity,
          type: 6,
          date: new Date(date).getTime(),
          reference: reference || null,
        }),
      });
      if (!txRes.ok) throw new Error("Failed to create transaction");
      const txData = (await txRes.json()) as { id: string };

      // Principal repayment entry
      const principalAmount = period.principal;
      const interestAmount = period.interest;
      const entryRes = await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: txData.id,
          entry_type: "principal",
          entity: liability.entity,
          object_type: "liability",
          object_id: liability.id,
          source: "loan_scheme",
          direction: "out",
          amount: principalAmount,
        }),
      });
      if (!entryRes.ok) throw new Error("Failed to record principal entry");

      // Interest entry
      const interestRes = await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: txData.id,
          entry_type: "interest",
          entity: liability.entity,
          object_type: "liability",
          object_id: liability.id,
          source: "loan_scheme",
          direction: "in",
          amount: interestAmount,
        }),
      });
      if (!interestRes.ok) throw new Error("Failed to record interest entry");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment — Period {period.period}</DialogTitle>
          <DialogDescription>
            Scheduled: {fmtNum(period.payment)} ({fmtNum(period.principal)}{" "}
            principal · {fmtNum(period.interest)} interest)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="rp-date">Date</Label>
            <Input
              id="rp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-ref">
              Reference{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="rp-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Payment #1"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Record payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LiabilitySheet({
  liability,
  open,
  onOpenChange,
  assetName,
  defaultTab = "overview",
}: {
  liability: Liability | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assetName?: string | null;
  defaultTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [tab, setTab] = React.useState(defaultTab);
  const [transactions, setTransactions] = React.useState<EntityTransaction[]>(
    [],
  );
  const [loadingLedger, setLoadingLedger] = React.useState(false);
  const [sourceNameMap, setSourceNameMap] = React.useState<Map<string, string>>(new Map());
  const [documents, setDocuments] = React.useState<EntityDocument[]>([]);
  const [docsLoading, setDocsLoading] = React.useState(false);
  const [expandedScheme, setExpandedScheme] =
    React.useState<PaymentScheme | null>(null);
  const [recordPeriod, setRecordPeriod] = React.useState<Period | null>(null);

  React.useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  // Fetch ledger entries when sheet opens
  const loadLedger = React.useCallback(() => {
    if (!liability) return;
    setLoadingLedger(true);
    fetch(`/api/transaction-entries?entity=${liability.entity}&object_id=${liability.id}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((payload: { entries?: unknown[] }) => {
        const raw = Array.isArray(payload.entries) ? payload.entries : [];
        const txs = mapRawEntriesToTransactions(raw);
        setTransactions(txs);

        const assetSourceIds = Array.from(new Set(
          txs.flatMap((tx) =>
            tx.legs
              .filter((l) => (l.source === "cash" || l.source === "asset") && l.sourceId)
              .map((l) => l.sourceId!),
          ),
        ));
        if (assetSourceIds.length > 0) {
          Promise.all(
            assetSourceIds.map((id) =>
              fetch(`/api/assets/${id}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => [id, d?.name ?? id] as [string, string]),
            ),
          )
            .then((entries) => setSourceNameMap(new Map(entries)))
            .catch(() => {});
        }
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoadingLedger(false));
  }, [liability?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open) return;
    loadLedger();
  }, [open, loadLedger]);

  const loadDocs = React.useCallback(() => {
    if (!liability) return;
    setDocsLoading(true);
    fetchDocuments(liability.entity)
      .then((all) =>
        setDocuments(all.filter((d) => d.objectType === "liability" && d.objectId === liability.id)),
      )
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, [liability?.id, liability?.entity]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (open) loadDocs();
  }, [open, loadDocs]);

  // Map period number → payment date, derived from repayment tx legs sorted by date
  const paidPeriods = React.useMemo(() => {
    const repayments = transactions
      .filter((tx) =>
        tx.legs.some(
          (l) =>
            l.objectId === liability?.id &&
            l.entryType === "principal" &&
            l.direction === "out",
        ),
      )
      .sort((a, b) => a.date - b.date);
    return new Map<number, number>(repayments.map((tx, i) => [i + 1, tx.date]));
  }, [transactions, liability?.id]);

  // Repayment progress based on actual recorded payments
  const repaymentProgress = React.useMemo(() => {
    if (!liability) return null;
    const p = liability.loan_amount;
    const r = liability.interest_rate;
    const t = liability.term_length;
    const freq = liability.frequency;
    const scheme = liability.scheme as PaymentScheme | null;
    if (!p || !r || !t || !freq || !scheme) return null;
    if (p <= 0 || t <= 0) return null;
    const periods = computeAll(p, r, freq, t)[scheme];
    const periodsCompleted = Math.min(paidPeriods.size, t);
    const closing =
      periodsCompleted > 0 ? (periods[periodsCompleted - 1]?.closing ?? 0) : p;
    const repaid = p - closing;
    const interestPaid = Array.from(paidPeriods.keys()).reduce(
      (sum, n) => sum + (periods[n - 1]?.interest ?? 0),
      0,
    );
    const pct = Math.min(100, Math.max(0, (repaid / p) * 100));
    return {
      pct,
      periodsCompleted,
      totalPeriods: t,
      remaining: closing,
      repaid,
      interestPaid,
    };
  }, [liability, paidPeriods]);

  // Compute amortization schedules
  const schedules = React.useMemo(() => {
    if (!liability) return null;
    const p = liability.loan_amount;
    const r = liability.interest_rate;
    const t = liability.term_length;
    const freq = liability.frequency;
    if (!p || !r || !t || !freq) return null;
    if (p <= 0 || r < 0 || t <= 0) return null;
    return computeAll(p, r, freq, t);
  }, [liability]);

  const showSourceCol = React.useMemo(
    () => transactions.some((tx) => tx.legs.some((l) => l.objectId === liability?.id && l.source)),
    [transactions, liability?.id],
  );

  if (!liability) return null;

  const activeScheme = liability.scheme as PaymentScheme | null;

  return (
    <>
      {recordPeriod && liability && (
        <RecordPaymentDialog
          period={recordPeriod}
          liability={liability}
          onClose={() => setRecordPeriod(null)}
          onSuccess={() => {
            setRecordPeriod(null);
            loadLedger();
          }}
        />
      )}
      {expandedScheme && schedules && (
        <FullScheduleDialog
          scheme={expandedScheme}
          periods={schedules[expandedScheme]}
          open
          onClose={() => setExpandedScheme(null)}
        />
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[90vw]! overflow-y-auto flex flex-col gap-0 p-0">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>{liability.name || "Unnamed liability"}</SheetTitle>
            <SheetDescription>
              {assetName && <span>Linked to {assetName}</span>}
              {liability.reference && (
                <span className="ml-2 text-muted-foreground/70">
                  · {liability.reference}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          {/* Prominent stats */}
          <div className="grid grid-cols-3 gap-px bg-border border-b">
            <div className="bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Loan amount
              </p>
              <p className="text-xl font-semibold mt-0.5 text-red-500">
                {liability.loan_amount != null
                  ? formatAmountWithCurrency(liability.loan_amount, null)
                  : "—"}
              </p>
            </div>
            <div className="bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Interest rate
              </p>
              <p className="text-xl font-semibold mt-0.5">
                {liability.interest_rate != null
                  ? `${liability.interest_rate}%`
                  : "—"}
              </p>
            </div>
            <div className="bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Term
              </p>
              <p className="text-xl font-semibold mt-0.5">
                {liability.term_length != null && liability.frequency
                  ? `${liability.term_length} ${termUnitLabel(liability.frequency)}`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Repayment progress */}
          {repaymentProgress && (
            <div className="px-6 py-3 border-b space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {repaymentProgress.periodsCompleted} of{" "}
                  {repaymentProgress.totalPeriods} payments
                </span>
                <span>{repaymentProgress.pct.toFixed(1)}% repaid</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${repaymentProgress.pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    Principal{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {fmtNum(repaymentProgress.repaid)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Interest{" "}
                    <span className="text-emerald-600 font-medium tabular-nums">
                      {fmtNum(repaymentProgress.interestPaid)}
                    </span>
                  </span>
                </div>
                <span className="text-muted-foreground">
                  Remaining{" "}
                  <span className="text-red-500 font-medium tabular-nums">
                    {fmtNum(repaymentProgress.remaining)}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="px-4 flex-1">
            <Tabs value={tab} onValueChange={setTab} className="h-full">
              <TabsList className="w-full justify-start gap-1 mt-4">
                <TabsTrigger className="px-3" value="overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger className="px-3" value="ledger">
                  Ledger
                  {transactions.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                      {transactions.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger className="px-3" value="scheme">
                  Scheme
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

              {/* ── Overview ── */}
              <TabsContent value="overview" className="mt-4 space-y-4 pb-8">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Frequency
                    </p>
                    <p className="font-medium">
                      {liability.frequency
                        ? frequencyLabel(liability.frequency)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Scheme</p>
                    <p className="font-medium capitalize">
                      {liability.scheme ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Start date
                    </p>
                    <p className="font-medium">{formatDate(liability.date)}</p>
                  </div>
                  {assetName && liability.asset && (
                    <div
                      className="rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors group"
                      onClick={() => {
                        const basePath = pathname
                          .split("/")
                          .slice(0, -1)
                          .join("/");
                        router.push(
                          `${basePath}/assets?asset=${liability.asset}`,
                        );
                        onOpenChange(false);
                      }}
                    >
                      <p className="text-xs text-muted-foreground mb-1">
                        Linked asset
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{assetName}</p>
                        <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}
                </div>

                {schedules && activeScheme && (
                  <div className="rounded-md border p-4 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      Repayment summary
                    </p>
                    {(() => {
                      const periods = schedules[activeScheme];
                      const totalInterest = periods.reduce(
                        (s, p) => s + p.interest,
                        0,
                      );
                      const totalCost = periods.reduce(
                        (s, p) => s + p.payment,
                        0,
                      );
                      const nextPeriodIdx = paidPeriods.size;
                      const nextPayment =
                        periods[nextPeriodIdx]?.payment ?? null;
                      return (
                        <div className="grid grid-cols-3 gap-3 text-sm mt-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Total cost
                            </p>
                            <p className="font-medium tabular-nums">
                              {fmtNum(totalCost)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Total interest
                            </p>
                            <p className="font-medium tabular-nums text-rose-500">
                              {fmtNum(totalInterest)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Next payment
                            </p>
                            <p className="font-medium tabular-nums">
                              {nextPayment != null ? fmtNum(nextPayment) : "—"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {liability.notes && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {liability.notes}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* ── Ledger ── */}
              <TabsContent value="ledger" className="mt-4 pb-8 text-sm">
                <div className="mb-4">
                  <p className="text-muted-foreground text-xs">
                    Transaction history for this liability.
                  </p>
                </div>
                {loadingLedger ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="text-muted-foreground rounded-md border p-4">
                    No transactions recorded against this liability.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-150 text-left text-sm">
                      <thead className="text-muted-foreground border-b">
                        <tr>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Reference</th>
                          <th className="px-3 py-2 font-medium">Entry</th>
                          <th className="px-3 py-2 font-medium">Amount</th>
                          {showSourceCol && (
                            <th className="px-3 py-2 font-medium">Source / Target</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {transactions
                          .slice()
                          .sort((a, b) => b.date - a.date)
                          .flatMap((tx) =>
                            tx.legs
                              .filter((leg) => leg.objectId === liability.id)
                              .map((leg) => (
                                <tr key={leg.id} className="border-b last:border-b-0">
                                  <td className="px-3 py-2 tabular-nums">
                                    {formatTxDate(tx.date)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                                      {tx.typeName || "—"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {tx.reference || "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="bg-muted/60 text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                      {leg.entryTypeLabel || leg.entryType}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`flex items-center gap-1 tabular-nums ${leg.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                                      {leg.direction === "in" ? (
                                        <ArrowDownLeft className="size-3.5 shrink-0" />
                                      ) : (
                                        <ArrowUpRight className="size-3.5 shrink-0" />
                                      )}
                                      {leg.direction === "in" ? "+" : "−"}
                                      {formatAmountWithCurrency(leg.amount, leg.currencyCode)}
                                    </span>
                                  </td>
                                  {showSourceCol && (
                                    <td className="px-3 py-2">
                                      {leg.source && leg.sourceId ? (
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const base = pathname.split("/").slice(0, -1).join("/");
                                                  if (leg.source === "cash" || leg.source === "asset") {
                                                    router.push(`${base}/assets?asset=${leg.sourceId}`);
                                                  } else {
                                                    router.push(`${base}/liabilities?liability=${leg.sourceId}`);
                                                  }
                                                }}
                                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                                              >
                                                {leg.source.replace(/_/g, " ")}
                                              </button>
                                            </TooltipTrigger>
                                            {sourceNameMap.get(leg.sourceId) && (
                                              <TooltipContent side="top">
                                                {sourceNameMap.get(leg.sourceId)}
                                              </TooltipContent>
                                            )}
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : leg.source ? (
                                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                                          {leg.source.replace(/_/g, " ")}
                                        </span>
                                      ) : "—"}
                                    </td>
                                  )}
                                </tr>
                              ))
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── Scheme ── */}
              <TabsContent value="scheme" className="mt-4 pb-8 space-y-4">
                {!schedules && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Loan amount, interest rate, term, and frequency are required
                    to compute the schedule.
                  </div>
                )}
                {schedules && (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      {(["linear", "bullet", "annuity"] as PaymentScheme[]).map(
                        (s) => (
                          <SchemeCard
                            key={s}
                            scheme={s}
                            periods={schedules[s]}
                            active={activeScheme === s}
                            onExpand={() => setExpandedScheme(s)}
                          />
                        ),
                      )}
                    </div>

                    {/* Inline table for active scheme */}
                    {activeScheme && (
                      <div className="rounded-md border overflow-hidden">
                        <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {schemeMeta(activeScheme).label} schedule
                          </p>
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => setExpandedScheme(activeScheme)}
                            title="Expand"
                          >
                            <Maximize2 className="size-3.5" />
                          </button>
                        </div>
                        <div className="overflow-x-auto max-h-72 overflow-y-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="sticky top-0 bg-background border-b text-muted-foreground">
                              <tr>
                                {[
                                  "#",
                                  "Opening",
                                  "Payment",
                                  "Interest",
                                  "Principal",
                                  "Closing",
                                  "",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className={`px-3 py-2 font-medium ${h !== "#" && h !== "" ? "text-right" : ""}`}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {schedules[activeScheme].map((p) => {
                                const paidAt = paidPeriods.get(p.period);
                                return (
                                  <tr
                                    key={p.period}
                                    className={`border-b last:border-0 hover:bg-muted/20 ${paidAt ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}
                                  >
                                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                                      {p.period}
                                    </td>
                                    <td className="px-3 py-1.5 tabular-nums text-right">
                                      {fmtNum(p.opening)}
                                    </td>
                                    <td className="px-3 py-1.5 tabular-nums text-right font-medium">
                                      {fmtNum(p.payment)}
                                    </td>
                                    <td className="px-3 py-1.5 tabular-nums text-right text-rose-500">
                                      {fmtNum(p.interest)}
                                    </td>
                                    <td className="px-3 py-1.5 tabular-nums text-right">
                                      {fmtNum(p.principal)}
                                    </td>
                                    <td className="px-3 py-1.5 tabular-nums text-right">
                                      {fmtNum(p.closing)}
                                    </td>
                                    <td className="px-3 py-1.5">
                                      {paidAt ? (
                                        <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
                                          ✓ {formatDate(paidAt)}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setRecordPeriod(p)}
                                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                                          title="Record payment"
                                        >
                                          <PlusCircle className="size-3" />
                                          Record
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── Documents ── */}
              <TabsContent value="documents" className="mt-4 pb-8">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">
                    {documents.length} document{documents.length !== 1 ? "s" : ""}
                  </p>
                  <UploadDocumentsDialog
                    entityId={liability.entity}
                    objectType="liability"
                    objectId={liability.id}
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
        </SheetContent>
      </Sheet>
    </>
  );
}
