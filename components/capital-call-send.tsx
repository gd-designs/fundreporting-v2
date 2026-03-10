"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";
import type { UnifiedEntity, Asset } from "@/lib/types";
import { notifyLedgerUpdate } from "@/lib/ledger-events";
import { AddEntityDialog } from "@/components/add-entity-dialog";

type MyCapitalCall = {
  id: string;
  entity: string;
  amount: number | null;
  acknowledged_at: number | null;
  shareholder_id: string | null;
  shareholder_name: string | null;
  price_per_share: number | number[] | null;
  entity_name: string | null;
  currency: { id: number; code: string; name: string } | null;
  country: { id: number; code: string; name: string } | null;
};

type Props = {
  capitalCall: MyCapitalCall;
  onSuccess: () => void;
};

function fmt(n: number | null | undefined, currencyCode?: string | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode ?? "EUR",
  }).format(n);
}

export function CapitalCallSend({ capitalCall, onSuccess }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [entities, setEntities] = React.useState<UnifiedEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = React.useState<string>("");
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [recordInvestment, setRecordInvestment] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [entitiesLoaded, setEntitiesLoaded] = React.useState(false);

  // Fetch entities on open (excluding the issuing entity)
  React.useEffect(() => {
    if (!open) return;
    setEntitiesLoaded(false);
    fetch("/api/entities")
      .then((r) => (r.ok ? r.json() : []))
      .then((all: UnifiedEntity[]) => {
        setEntities(all.filter((e) => e.entity !== capitalCall.entity));
        setEntitiesLoaded(true);
      })
      .catch(() => setEntitiesLoaded(true));
    setAmount(capitalCall.amount != null ? String(capitalCall.amount) : "");
    setDate(new Date());
    setSelectedEntityId("");
    setSelectedAssetId("");
    setError(null);
  }, [open, capitalCall.amount, capitalCall.entity]);

  const [noCashAssets, setNoCashAssets] = React.useState(false);

  // Fetch investable_cash assets when entity changes
  React.useEffect(() => {
    if (!selectedEntityId) {
      setAssets([]);
      setSelectedAssetId("");
      setNoCashAssets(false);
      return;
    }
    const entity = entities.find((e) => e.id === selectedEntityId);
    if (!entity) return;
    fetch(`/api/assets?entity=${entity.entity}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Asset[]) => {
        const cash = all.filter((a) => a.investable === "investable_cash");
        setAssets(cash);
        setNoCashAssets(cash.length === 0);
        const match =
          capitalCall.currency?.id != null
            ? (cash.find((a) => a.currency === capitalCall.currency!.id) ?? cash[0])
            : cash[0];
        setSelectedAssetId(match?.id ?? "");
      })
      .catch(() => {});
  }, [selectedEntityId, entities, capitalCall.currency?.id]);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const pricePerShare = Array.isArray(capitalCall.price_per_share)
      ? capitalCall.price_per_share[0]
      : capitalCall.price_per_share;
    const countryId = capitalCall.country?.id ?? null;
    if (!selectedEntityId || !selectedEntity) {
      setError("Select an entity.");
      return;
    }
    if (!noCashAssets && (!selectedAssetId || !selectedAsset)) {
      setError("Select a cash asset.");
      return;
    }
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
      // Resolve cash asset — auto-create if the entity has none
      let cashAssetId = selectedAssetId;
      let cashCurrencyId = selectedAsset?.currency ?? null;

      if (noCashAssets) {
        const currencyId = capitalCall.currency?.id ?? selectedEntity._currency?.id ?? null;
        const currencyName = capitalCall.currency?.code ?? selectedEntity._currency?.code ?? "Cash";
        const newAssetRes = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: selectedEntity.entity,
            name: currencyName,
            investable: "investable_cash",
            asset_class: 1,
            ...(currencyId != null ? { currency: currencyId } : {}),
          }),
        });
        if (!newAssetRes.ok) throw new Error(await newAssetRes.text());
        const newAsset = (await newAssetRes.json()) as Asset;
        cashAssetId = newAsset.id;
        cashCurrencyId = newAsset.currency;
      }

      // 1. Create transaction header
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: selectedEntity.entity,
          date: date!.getTime(),
          type: 13,
        }),
      });
      if (!txRes.ok) throw new Error(await txRes.text());
      const tx = (await txRes.json()) as { id: string };

      const cashEntryBody = {
        transaction: tx.id,
        entry_type: "cash",
        entity: selectedEntity.entity,
        object_type: "asset",
        object_id: cashAssetId,
        ...(cashCurrencyId != null ? { currency: cashCurrencyId } : {}),
        amount: parsedAmount,
        source: "cap",
        source_id: capitalCall.id,
      };

      // 2. If recording new money in, create a cash-in entry first (nets with
      //    the cash-out so the asset balance is unaffected)
      if (recordInvestment) {
        const cashInRes = await fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...cashEntryBody, direction: "in" }),
        });
        if (!cashInRes.ok) throw new Error(await cashInRes.text());
      }

      // 3. Create cash-out entry linked to the capital call
      const entryRes = await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cashEntryBody, direction: "out" }),
      });
      if (!entryRes.ok) throw new Error(await entryRes.text());

      // 4. Upsert equity stake asset on LP's portfolio
      let createdEquityAssetId: string | null = null;
      if (capitalCall.shareholder_id) {
        const allAssetsRes = await fetch(
          `/api/assets?entity=${selectedEntity.entity}`,
        );
        const allAssets: Asset[] = allAssetsRes.ok
          ? await allAssetsRes.json()
          : [];
        const existing = allAssets.find(
          (a) =>
            a.cap_table_shareholder === capitalCall.shareholder_id &&
            a.investable === "equity_stake",
        );

        let equityAssetId: string;
        if (existing) {
          equityAssetId = existing.id;
        } else {
          const newAssetRes = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entity: selectedEntity.entity,
              name:
                capitalCall.entity_name ??
                capitalCall.shareholder_name ??
                "Equity Stake",
              investable: "equity_stake",
              asset_class: 3,
              cap_table_shareholder: capitalCall.shareholder_id,
              ...(capitalCall.currency?.id != null
                ? { currency: capitalCall.currency.id }
                : {}),
              ...(countryId != null ? { country: countryId } : {}),
            }),
          });
          if (!newAssetRes.ok) throw new Error(await newAssetRes.text());
          equityAssetId = ((await newAssetRes.json()) as Asset).id;
        }

        const equityEntryRes = await fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: tx.id,
            entry_type: "equity",
            entity: selectedEntity.entity,
            object_type: "asset",
            object_id: equityAssetId,
            direction: "in",
            ...(capitalCall.currency?.id != null
              ? { currency: capitalCall.currency.id }
              : {}),
            amount: parsedAmount,
            ...(pricePerShare != null
              ? {
                  price_per_unit: pricePerShare,
                  units: parsedAmount / pricePerShare,
                }
              : {}),
            source: "cap",
            source_id: capitalCall.id,
          }),
        });
        if (!equityEntryRes.ok) throw new Error(await equityEntryRes.text());
        createdEquityAssetId = equityAssetId;
      }

      // 5. Mark capital call as paid, acknowledged, and record received_at
      await fetch(`/api/capital-calls/${capitalCall.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          received_at: date!.getTime(),
          ...(!capitalCall.acknowledged_at
            ? { acknowledged_at: Date.now() }
            : {}),
        }),
      });

      setOpen(false);
      notifyLedgerUpdate();
      onSuccess();
      const typePath = selectedEntity.type.replace(/_/g, "-");
      const base = `/${typePath}/${selectedEntity.id}/assets`;
      router.push(createdEquityAssetId ? `${base}?asset=${createdEquityAssetId}` : base);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          Send Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Capital Call Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-md bg-muted px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Amount due: </span>
            <span className="font-semibold tabular-nums">
              {fmt(capitalCall.amount, capitalCall.currency?.code)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entity-select">Pay from entity</Label>
            <Select
              value={selectedEntityId}
              onValueChange={setSelectedEntityId}
              disabled={entitiesLoaded && entities.length === 0}
            >
              <SelectTrigger className="w-full" id="entity-select">
                <SelectValue placeholder="Select entity…" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name ?? e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {entitiesLoaded && entities.length === 0 && (
              <p className="text-xs text-muted-foreground">
                You don&apos;t have any entities yet.{" "}
                <AddEntityDialog>
                  <button type="button" className="underline underline-offset-2 hover:text-foreground transition-colors">
                    Create one now
                  </button>
                </AddEntityDialog>
                {" "}to record this payment.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-select">Cash asset to debit</Label>
            {noCashAssets ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                No cash assets found — one will be created automatically when you record this payment.
              </p>
            ) : (
              <Select
                value={selectedAssetId}
                onValueChange={setSelectedAssetId}
                disabled={!selectedEntityId}
              >
                <SelectTrigger className="w-full" id="asset-select">
                  <SelectValue placeholder={!selectedEntityId ? "Select entity first" : "Select cash asset…"} />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name ?? a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedAssetId && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Record new money in</p>
                <p className="text-xs text-muted-foreground">
                  Record new money in to fund this payment, or turn off to use {selectedAsset?.name ?? "the selected asset"}&apos;s existing balance.
                </p>
              </div>
              <Switch
                id="record-investment"
                checked={recordInvestment}
                onCheckedChange={setRecordInvestment}
              />
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
              {saving ? "Recording…" : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
