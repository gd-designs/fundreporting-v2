"use client";

import * as React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePickerInput } from "@/components/date-time-input";

type Currency = { id: number; code: string; name: string };

type Props = {
  children: React.ReactNode;
  entityUUID: string;
  assetId: string;
  assetName: string;
  currencies: Currency[];
  defaultCurrencyId?: number;
  onSuccess: () => void;
};

export function MoneyInDialog({
  children,
  entityUUID,
  assetId,
  assetName,
  currencies,
  defaultCurrencyId,
  onSuccess,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Resolved "New Money In" transaction type ID — looked up automatically, never shown as editable
  const [moneyInTypeId, setMoneyInTypeId] = React.useState<number | null>(null);

  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [currencyId, setCurrencyId] = React.useState<string>(
    defaultCurrencyId != null ? String(defaultCurrencyId) : "",
  );
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Resolve "New Money In" transaction type on first open
  React.useEffect(() => {
    if (!open || moneyInTypeId !== null) return;
    fetch("/api/transaction-types")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: number; name: string }[]) => {
        const match = data.find(
          (t) =>
            t.name.toLowerCase().replace(/\s+/g, " ").trim() === "new money in",
        );
        if (match) setMoneyInTypeId(match.id);
      })
      .catch(() => {});
  }, [open, moneyInTypeId]);

  // Keep currency in sync if defaultCurrencyId changes
  React.useEffect(() => {
    if (defaultCurrencyId != null && !currencyId) {
      setCurrencyId(String(defaultCurrencyId));
    }
  }, [defaultCurrencyId, currencyId]);

  const reset = () => {
    setAmount("");
    setDate(new Date());
    setCurrencyId(defaultCurrencyId != null ? String(defaultCurrencyId) : "");
    setReference("");
    setNotes("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!currencyId) {
      setError("Select a currency.");
      return;
    }
    if (!date) {
      setError("Select a date.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // 1. Create transaction header
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: entityUUID,
          date: date.getTime(),
          ...(moneyInTypeId != null ? { type: moneyInTypeId } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      if (!txRes.ok) throw new Error(await txRes.text());
      const tx = (await txRes.json()) as { id: string };

      // 2. Create cash-in entry leg
      const entryRes = await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: tx.id,
          entry_type: "cash",
          entity: entityUUID,
          object_type: "asset",
          object_id: assetId,
          direction: "in",
          currency: Number(currencyId),
          amount: parsedAmount,
        }),
      });
      if (!entryRes.ok) throw new Error(await entryRes.text());

      setOpen(false);
      reset();
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record transaction.",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedCurrency = currencies.find((c) => String(c.id) === currencyId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Money in — {assetName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {/* Amount + Currency */}
          <div className="grid gap-2">
            <Label>Amount</Label>
            <div className="flex gap-2">
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue placeholder="CCY" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={`0.00${selectedCurrency ? ` ${selectedCurrency.code}` : ""}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Date */}
          <DateTimePickerInput
            id="money-in-date"
            label="Date"
            value={date}
            onChange={setDate}
          />

          {/* Reference */}
          <div className="grid gap-2">
            <Label htmlFor="money-in-ref">
              Reference{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="money-in-ref"
              placeholder="e.g. TRF-001"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="money-in-notes">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="money-in-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes..."
              className="border-input bg-background min-h-16 rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !amount || !currencyId}
          >
            {saving ? "Recording..." : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
