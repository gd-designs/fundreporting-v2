"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadRecord } from "@/components/lead-sheet";

type Fund = { id: string; name?: string | null; entity?: string | null };

type InterestRow = {
  fund: string;
  fundName: string;
  fundEntity: string;
  shareClass?: string | null;
  committedAmount?: number | null;
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ConvertToInvestorDialog({
  open,
  onOpenChange,
  lead,
  funds,
  assetManagerEntityId,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRecord | null;
  funds: Fund[];
  assetManagerEntityId: string;
  onConverted: (updatedLead: LeadRecord) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [type, setType] = React.useState<"individual" | "company">("individual");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Derive interest rows with fund entity IDs resolved
  const interestRows = React.useMemo<InterestRow[]>(() => {
    if (!lead?.interests) return [];
    return lead.interests.flatMap((i) => {
      if (!i.fund) return [];
      const fund = funds.find((f) => f.id === i.fund);
      if (!fund?.entity) return [];
      return [
        {
          fund: fund.id,
          fundName: fund.name ?? fund.id,
          fundEntity: fund.entity,
          shareClass: i.share_class ?? null,
          committedAmount: i.committed_amount ?? null,
        },
      ];
    });
  }, [lead?.interests, funds]);

  React.useEffect(() => {
    if (open && lead) {
      setName(lead.name ?? "");
      setEmail(lead.email ?? "");
      setType("individual");
      setError(null);
    }
  }, [open, lead?.id]);

  async function handleConvert() {
    if (!lead) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/investor-leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          type,
          assetManagerEntityId,
          interests: interestRows.map((r) => ({
            fundEntity: r.fundEntity,
            shareClass: r.shareClass ?? undefined,
            committedAmount: r.committedAmount ?? undefined,
          })),
        }),
      });

      const data = (await res.json()) as { error?: string; lead?: LeadRecord };
      if (!res.ok && res.status !== 207) {
        throw new Error(data.error ?? "Failed to convert investor.");
      }

      onConverted({ ...lead, ...(data.lead ?? {}), status: "investor" });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to investor</DialogTitle>
          <DialogDescription>
            Creates a shareholder record at the asset manager and fund level,
            and a commitment entry for each fund allocation. Capital calls can
            be issued separately from the Committed Investors tab.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Name + email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Shareholder type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as "individual" | "company")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fund interests */}
          {interestRows.length > 0 && (
            <div className="space-y-1.5">
              <Label>Fund allocations <span className="text-muted-foreground font-normal text-xs">(pending capital calls)</span></Label>
              <div className="rounded-md border divide-y text-sm">
                {interestRows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="font-medium">{row.fundName}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(row.committedAmount)}
                    </span>
                  </div>
                ))}
                {interestRows.length > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
                    <span className="text-muted-foreground">Total commitment</span>
                    <span className="font-medium">
                      {formatCurrency(
                        interestRows.reduce((s, r) => s + (r.committedAmount ?? 0), 0),
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {interestRows.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
              No fund interests linked — shareholder will be created without a
              cap table entry.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Converting…
                </>
              ) : (
                "Convert to investor"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
