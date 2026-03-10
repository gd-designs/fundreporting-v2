"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Asset, UnifiedEntity } from "@/lib/types";
import type { CapitalCall } from "@/lib/cap-table";
import { notifyLedgerUpdate } from "@/lib/ledger-events";

type Props = {
  capitalCall: CapitalCall;
  entityUUID: string; // fund entity UUID
  currencyCode?: string;
  label?: string;
  onSuccess: () => void;
};

function fmt(n: number | null | undefined, currencyCode = "EUR") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
  }).format(n);
}

export function CapitalCallReceive({ capitalCall, entityUUID, currencyCode = "EUR", label = "Receive Funds", onSuccess }: Props) {
  const [open, setOpen] = React.useState(false);
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>("");
  const [entityCurrencyId, setEntityCurrencyId] = React.useState<number | null>(null);
  const [entityCurrencyName, setEntityCurrencyName] = React.useState<string | null>(null);
  const [entityCountryId, setEntityCountryId] = React.useState<number | null>(null);
  const [amount, setAmount] = React.useState<string>("");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`/api/assets?entity=${entityUUID}`).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/entities").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([allAssets, allEntities]: [Asset[], UnifiedEntity[]]) => {
        const cash = allAssets.filter((a) => a.investable === "investable_cash");
        setAssets(cash);
        setSelectedAssetId(cash[0]?.id ?? "");
        const entity = allEntities.find((e) => e.entity === entityUUID);
        setEntityCurrencyId(entity?._currency?.id ?? entity?.currency ?? null);
        setEntityCurrencyName(entity?._currency?.name ?? null);
        setEntityCountryId(typeof entity?.country === "number" ? entity.country : null);
      })
      .catch(() => {});
    setAmount(capitalCall.amount != null ? String(capitalCall.amount) : "");
    setDate(new Date());
    setError(null);
  }, [open, capitalCall.amount, entityUUID]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const noCashAssets = assets.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!date) {
      setError("Select a date.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Resolve the cash asset — auto-create if none exists
      let cashAssetId = selectedAssetId;
      let cashCurrencyId = selectedAsset?.currency ?? null;

      if (noCashAssets) {
        const newAssetRes = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID,
            name: entityCurrencyName ?? "Cash",
            investable: "investable_cash",
            asset_class: 1,
            ...(entityCurrencyId != null ? { currency: entityCurrencyId } : {}),
            ...(entityCountryId != null ? { country: entityCountryId } : {}),
          }),
        });
        if (!newAssetRes.ok) throw new Error(await newAssetRes.text());
        const newAsset = (await newAssetRes.json()) as Asset;
        cashAssetId = newAsset.id;
        cashCurrencyId = newAsset.currency;
      } else if (!selectedAssetId || !selectedAsset) {
        setError("Select a cash asset.");
        setSaving(false);
        return;
      }

      // 1. Create transaction header
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: entityUUID,
          date: date.getTime(),
          type: 13,
        }),
      });
      if (!txRes.ok) throw new Error(await txRes.text());
      const tx = (await txRes.json()) as { id: string };

      // 2. Create cash-in entry on the company's cash asset
      const entryRes = await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: tx.id,
          entry_type: "cash",
          entity: entityUUID,
          object_type: "asset",
          object_id: cashAssetId,
          direction: "in",
          ...(cashCurrencyId != null ? { currency: cashCurrencyId } : {}),
          amount: parsedAmount,
          source: "cap",
          source_id: capitalCall.id,
        }),
      });
      if (!entryRes.ok) throw new Error(await entryRes.text());

      // 3. Stamp deployed_at on the capital call
      await fetch(`/api/capital-calls/${capitalCall.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployed_at: date.getTime() }),
      });

      setOpen(false);
      notifyLedgerUpdate();
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record receipt.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive Capital Call Funds</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-md bg-muted px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Amount received: </span>
            <span className="font-semibold tabular-nums">
              {fmt(capitalCall.amount, currencyCode)}
            </span>
          </div>

          {noCashAssets ? (
            <div className="rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
              No cash asset found. A cash asset will be automatically created
              for the currency of this investment when you record the receipt.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="asset-select">Cash asset to credit</Label>
              <Select
                value={selectedAssetId}
                onValueChange={setSelectedAssetId}
              >
                <SelectTrigger className="w-full" id="asset-select">
                  <SelectValue placeholder="Select cash asset…" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name ?? a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="amount-input">Amount</Label>
            <Input
              id="amount-input"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <DatePickerInput label="Date" value={date} onChange={setDate} />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Recording…" : "Record Receipt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
