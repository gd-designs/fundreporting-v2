"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePickerInput } from "@/components/date-time-input";
import { fetchMarketQuote, fetchMarketPriceAt } from "@/lib/market";

type Currency = { id: number; code: string; name: string };
type CashAsset = { id: string; name: string; currencyCode: string };
type Instrument = { ticker: string; name?: string };

type Mode = "buy" | "sell";

type Props = {
  children: React.ReactNode;
  entityUUID: string;
  assetId: string;
  assetName: string;
  currencies: Currency[];
  defaultCurrencyId?: number;
  cashAssets: CashAsset[];
  costBasis?: number;
  instrument?: Instrument | null;
  onSuccess: () => void;
};

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function BuySellDialog({
  children,
  entityUUID,
  assetId,
  assetName,
  currencies,
  defaultCurrencyId,
  cashAssets,
  costBasis = 0,
  instrument,
  onSuccess,
}: Props) {
  const isTicker = !!instrument?.ticker;

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<Mode>("buy");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [currencyId, setCurrencyId] = React.useState<string>(
    defaultCurrencyId != null ? String(defaultCurrencyId) : "",
  );
  const [cashAssetId, setCashAssetId] = React.useState("");
  const [recordNewMoneyIn, setRecordNewMoneyIn] = React.useState(true);
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // ── Non-ticker fields ────────────────────────────────────────────────────
  const [amount, setAmount] = React.useState("");

  // ── Ticker-specific fields ───────────────────────────────────────────────
  const [units, setUnits] = React.useState("");
  const [pricePerUnit, setPricePerUnit] = React.useState("");
  const [priceSource, setPriceSource] = React.useState<"live" | "eod" | "manual" | null>(null);
  const [fetchingPrice, setFetchingPrice] = React.useState(false);

  const parsedUnits = parseFloat(units);
  const parsedPrice = parseFloat(pricePerUnit);
  const tickerTotal =
    Number.isFinite(parsedUnits) && Number.isFinite(parsedPrice)
      ? parsedUnits * parsedPrice
      : null;

  // Transaction type IDs
  const [buyTypeId, setBuyTypeId] = React.useState<number | null>(null);
  const [sellTypeId, setSellTypeId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open || (buyTypeId !== null && sellTypeId !== null)) return;
    fetch("/api/transaction-types")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: number; name: string }[]) => {
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
        const buy = data.find((t) => norm(t.name) === "buy");
        const sell = data.find((t) => norm(t.name) === "sale" || norm(t.name) === "sell");
        if (buy) setBuyTypeId(buy.id);
        if (sell) setSellTypeId(sell.id);
      })
      .catch(() => {});
  }, [open, buyTypeId, sellTypeId]);

  React.useEffect(() => {
    if (defaultCurrencyId != null && !currencyId)
      setCurrencyId(String(defaultCurrencyId));
  }, [defaultCurrencyId, currencyId]);

  // ── Price fetch for ticker mode ──────────────────────────────────────────
  const fetchIndicativePrice = React.useCallback(
    async (forDate: Date) => {
      if (!instrument?.ticker) return;
      setFetchingPrice(true);
      try {
        if (isToday(forDate)) {
          const q = await fetchMarketQuote(instrument.ticker);
          if (typeof q.price === "number" && q.price > 0) {
            setPricePerUnit(q.price.toFixed(4));
            setPriceSource("live");
          }
        } else {
          const p = await fetchMarketPriceAt(instrument.ticker, forDate.getTime());
          if (typeof p.price === "number" && p.price > 0) {
            setPricePerUnit(p.price.toFixed(4));
            setPriceSource("eod");
          }
        }
      } catch {
        // silently fail — user can enter manually
      } finally {
        setFetchingPrice(false);
      }
    },
    [instrument?.ticker],
  );

  // Fetch price on open and when date changes (ticker mode only)
  React.useEffect(() => {
    if (!open || !isTicker || !date) return;
    void fetchIndicativePrice(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isTicker]);

  const handleDateChange = (d: Date | undefined) => {
    setDate(d);
    if (isTicker && d) void fetchIndicativePrice(d);
  };

  // Cash account helpers
  const selectedCurrency = currencies.find((c) => String(c.id) === currencyId);
  const matchedCashAssets = React.useMemo(() => {
    if (!selectedCurrency) return cashAssets;
    return cashAssets.filter(
      (a) => a.currencyCode.toUpperCase() === selectedCurrency.code.toUpperCase(),
    );
  }, [cashAssets, selectedCurrency]);

  const needsNewCashAccount =
    matchedCashAssets.length === 0 && !cashAssetId && !!currencyId;

  React.useEffect(() => {
    if (matchedCashAssets.length > 0 && !cashAssetId) {
      setCashAssetId(matchedCashAssets[0]!.id);
    } else if (matchedCashAssets.length === 0) {
      setCashAssetId("");
    }
  }, [matchedCashAssets, cashAssetId]);

  const reset = () => {
    setMode("buy");
    setAmount("");
    setUnits("");
    setPricePerUnit("");
    setPriceSource(null);
    setDate(new Date());
    setCurrencyId(defaultCurrencyId != null ? String(defaultCurrencyId) : "");
    setCashAssetId("");
    setRecordNewMoneyIn(true);
    setReference("");
    setNotes("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleSubmit = async () => {
    // Resolve the transaction amount
    const parsedAmount = isTicker
      ? tickerTotal ?? NaN
      : parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(isTicker ? "Enter valid units and price." : "Enter a valid amount.");
      return;
    }
    if (isTicker && (!Number.isFinite(parsedUnits) || parsedUnits <= 0)) {
      setError("Enter a valid number of units.");
      return;
    }
    if (!currencyId) { setError("Select a currency."); return; }
    if (!date) { setError("Select a date."); return; }
    if (!needsNewCashAccount && !cashAssetId) { setError("Select a cash account."); return; }

    setSaving(true);
    setError(null);
    try {
      const typeId = mode === "buy" ? buyTypeId : sellTypeId;

      // 1. Transaction header
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: entityUUID,
          date: date.getTime(),
          ...(typeId != null ? { type: typeId } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      if (!txRes.ok) throw new Error(await txRes.text());
      const tx = (await txRes.json()) as { id: string };

      // 2. Auto-create cash account if needed
      let resolvedCashAssetId = cashAssetId;
      if (needsNewCashAccount && selectedCurrency) {
        const newCashRes = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID,
            name: `${selectedCurrency.code} Cash`,
            currency: Number(currencyId),
            asset_class: "cash",
          }),
        });
        if (!newCashRes.ok) throw new Error(await newCashRes.text());
        const newCash = (await newCashRes.json()) as { id: string };
        resolvedCashAssetId = newCash.id;
      }

      // 3. Entry legs
      if (mode === "buy") {
        if (recordNewMoneyIn || needsNewCashAccount) {
          await fetch("/api/transaction-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transaction: tx.id, entry_type: "cash", entity: entityUUID,
              object_type: "asset", object_id: resolvedCashAssetId,
              direction: "in", currency: Number(currencyId), amount: parsedAmount,
            }),
          });
        }
        await fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: tx.id, entry_type: "cash", entity: entityUUID,
            object_type: "asset", object_id: resolvedCashAssetId,
            direction: "out", currency: Number(currencyId), amount: parsedAmount,
          }),
        });
        const assetInRes = await fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: tx.id, entry_type: "asset", entity: entityUUID,
            object_type: "asset", object_id: assetId,
            direction: "in", currency: Number(currencyId), amount: parsedAmount,
            ...(isTicker && Number.isFinite(parsedUnits) ? { units: parsedUnits } : {}),
          }),
        });
        if (!assetInRes.ok) throw new Error(await assetInRes.text());
      } else {
        const assetOutRes = await fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: tx.id, entry_type: "asset", entity: entityUUID,
            object_type: "asset", object_id: assetId,
            direction: "out", currency: Number(currencyId), amount: parsedAmount,
            ...(isTicker && Number.isFinite(parsedUnits) ? { units: parsedUnits } : {}),
          }),
        });
        if (!assetOutRes.ok) throw new Error(await assetOutRes.text());
        await fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: tx.id, entry_type: "cash", entity: entityUUID,
            object_type: "asset", object_id: resolvedCashAssetId,
            direction: "in", currency: Number(currencyId), amount: parsedAmount,
          }),
        });
        // For non-ticker assets only: create a revaluation mutation to reconcile
        // the stored balance with the sale proceeds. Ticker assets track P&L
        // via EOD price history so no mutation is needed.
        if (!isTicker) {
          const delta = parsedAmount - costBasis;
          if (Math.abs(delta) > 0.005) {
            await fetch("/api/mutations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entity: entityUUID, asset: assetId,
                date: date.getTime(), delta, source: "transaction", source_id: tx.id,
              }),
            });
          }
        }
      }

      setOpen(false);
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record transaction.");
    } finally {
      setSaving(false);
    }
  };

  const selectedCurrencyCode = selectedCurrency?.code ?? "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{assetName}</DialogTitle>
          {isTicker && (
            <p className="text-muted-foreground text-xs">{instrument!.ticker}</p>
          )}
        </DialogHeader>

        <div className="grid gap-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? m === "buy"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {m === "buy" ? "Buy" : "Sell"}
              </button>
            ))}
          </div>

          {isTicker ? (
            /* ── Ticker form ─────────────────────────────────────── */
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Units */}
                <div className="grid gap-1.5">
                  <Label htmlFor="bs-units">Units</Label>
                  <Input
                    id="bs-units"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                  />
                </div>
                {/* Price per unit */}
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bs-price">Price per unit</Label>
                    {fetchingPrice && (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    )}
                    {!fetchingPrice && priceSource && (
                      <span className="text-[10px] text-muted-foreground">
                        {priceSource === "live" ? "Live" : priceSource === "eod" ? "Indicative EOD" : "Manual"}
                      </span>
                    )}
                  </div>
                  <Input
                    id="bs-price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.0000"
                    value={pricePerUnit}
                    onChange={(e) => { setPricePerUnit(e.target.value); setPriceSource("manual"); }}
                  />
                </div>
              </div>

              {/* Total */}
              <div className="rounded-md bg-muted px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {tickerTotal != null
                    ? `${selectedCurrencyCode} ${tickerTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </span>
              </div>

              {/* Currency — fixed for ticker assets */}
              <div className="grid gap-1.5">
                <Label>Currency</Label>
                <div className="border-input bg-muted text-muted-foreground flex h-9 w-full items-center rounded-md border px-3 text-sm">
                  {selectedCurrency ? `${selectedCurrency.code} — ${selectedCurrency.name}` : "—"}
                </div>
              </div>
            </>
          ) : (
            /* ── Standard form ───────────────────────────────────── */
            <div className="grid gap-2">
              <Label>{mode === "buy" ? "Purchase amount" : "Sale proceeds"}</Label>
              <div className="flex gap-2">
                <Select value={currencyId} onValueChange={setCurrencyId}>
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue placeholder="CCY" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`0.00${selectedCurrencyCode ? ` ${selectedCurrencyCode}` : ""}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {/* Date */}
          <DateTimePickerInput
            id="buy-sell-date"
            label="Date"
            value={date}
            onChange={handleDateChange}
          />

          {/* Cash account */}
          <div className="grid gap-2">
            <Label>{mode === "buy" ? "Funded from" : "Proceeds to"}</Label>
            {needsNewCashAccount ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  No {selectedCurrency?.code} cash account found
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                  A new {selectedCurrency?.code} cash account will be created automatically
                  {mode === "buy" ? " and the purchase amount will be recorded as new money in." : " to receive the proceeds."}
                </p>
              </div>
            ) : (
              <Select value={cashAssetId} onValueChange={setCashAssetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select cash account…" />
                </SelectTrigger>
                <SelectContent>
                  {matchedCashAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                  {matchedCashAssets.length === 0 && cashAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currencyCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Sell gain/loss notice — non-ticker only (ticker P&L is tracked via EOD history) */}
          {mode === "sell" && !isTicker && (() => {
            const saleAmount = parseFloat(amount);
            if (!saleAmount || !Number.isFinite(saleAmount) || costBasis <= 0) return null;
            const delta = saleAmount - costBasis;
            if (Math.abs(delta) < 0.005) return null;
            const isGain = delta > 0;
            return (
              <div className={`rounded-md border p-3 text-sm ${isGain ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"}`}>
                <p className={`font-medium ${isGain ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}`}>
                  {isGain ? "Gain" : "Loss"} of {Math.abs(delta).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{selectedCurrencyCode ? ` ${selectedCurrencyCode}` : ""}
                </p>
                <p className={`text-xs mt-0.5 ${isGain ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  A revaluation mutation of {isGain ? "+" : ""}{delta.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be recorded automatically.
                </p>
              </div>
            );
          })()}

          {/* Record new money in toggle */}
          {mode === "buy" && cashAssetId && !needsNewCashAccount && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">
                  {recordNewMoneyIn ? "Record new money in" : "Deplete current cash balance"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {recordNewMoneyIn
                    ? "Adds a money-in entry to the cash account before the purchase."
                    : "Uses the existing cash balance — no new money-in entry recorded."}
                </p>
              </div>
              <Switch checked={recordNewMoneyIn} onCheckedChange={setRecordNewMoneyIn} />
            </div>
          )}

          {/* Reference */}
          <div className="grid gap-2">
            <Label htmlFor="buy-sell-ref">Reference <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="buy-sell-ref" placeholder="e.g. TRF-001" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="buy-sell-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <textarea
              id="buy-sell-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes…"
              className="border-input bg-background min-h-16 rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || (isTicker ? !tickerTotal : !amount) || !currencyId}
            className={mode === "sell" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
          >
            {saving ? "Recording…" : mode === "buy" ? "Record purchase" : "Record sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
