"use client";

import * as React from "react";
import { Loader2, Plus, Pencil, Trash2, Mail } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { DatePickerInput } from "@/components/date-input";
import { CapitalCallReceive } from "@/components/capital-call-receive";
import { ShareholderDocumentsTab } from "@/components/shareholder-documents-tab";
import {
  type CapTableShareholder,
  type CapTableFundChild,
  type CapTableEntry,
  type CapitalCall,
  type ShareClass,
} from "@/lib/cap-table";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CALL_STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

const CALL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
};

// ─── Capital Call Dialog ──────────────────────────────────────────────────────

function CapitalCallDialog({
  open,
  onClose,
  entityUUID,
  entryId,
  existing,
  onSaved,
  committedAmount,
  alreadyCalled,
  shareClasses,
}: {
  open: boolean;
  onClose: () => void;
  entityUUID: string;
  entryId: string;
  existing: CapitalCall | null;
  onSaved: () => void;
  committedAmount: number | null;
  alreadyCalled: number;
  shareClasses: ShareClass[];
}) {
  const [amount, setAmount] = React.useState("");
  const [status, setStatus] = React.useState("pending");
  const [calledAt, setCalledAt] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [shareClass, setShareClass] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      if (existing?.amount != null) {
        setAmount(String(existing.amount));
      } else if (committedAmount != null) {
        const remaining = committedAmount - alreadyCalled;
        setAmount(remaining > 0 ? String(remaining) : "");
      } else {
        setAmount("");
      }
      setStatus(existing?.status ?? "pending");
      setCalledAt(
        existing?.called_at
          ? toYmd(new Date(existing.called_at))
          : toYmd(new Date()),
      );
      setDueDate(existing?.due_date ? toYmd(new Date(existing.due_date)) : "");
      setShareClass(existing?.share_class ?? "");
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = existing
        ? {
            amount: amount ? Number(amount) : null,
            status,
            called_at: calledAt ? new Date(calledAt).getTime() : null,
            due_date: dueDate ? new Date(dueDate).getTime() : null,
            share_class: shareClass || null,
          }
        : {
            entity: entityUUID,
            cap_table_entry: entryId,
            amount: amount ? Number(amount) : null,
            status,
            called_at: calledAt ? new Date(calledAt).getTime() : null,
            due_date: dueDate ? new Date(dueDate).getTime() : null,
            share_class: shareClass || null,
          };
      const url = existing
        ? `/api/capital-calls/${existing.id}`
        : `/api/capital-calls`;
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Failed to save capital call.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const remaining =
    committedAmount != null
      ? committedAmount - alreadyCalled - (parseFloat(amount) || 0)
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {existing ? "Edit Capital Call" : "Record Capital Call"}
            </DialogTitle>
            <DialogDescription>
              Record a drawdown against this commitment.
            </DialogDescription>
          </DialogHeader>
          {committedAmount != null && (
            <div className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Committed</span>
                <span className="tabular-nums font-medium">
                  {fmt(committedAmount)}
                </span>
              </div>
              {alreadyCalled > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Previously called
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    −{fmt(alreadyCalled)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground">
                  Remaining after this call
                </span>
                <span
                  className={`tabular-nums font-medium ${remaining != null && remaining < 0 ? "text-destructive" : ""}`}
                >
                  {fmt(remaining)}
                </span>
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-amount">Amount</Label>
              <Input
                id="cc-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DatePickerInput
              id="cc-called"
              label="Called Date"
              value={calledAt ? new Date(calledAt) : undefined}
              onChange={(d) => setCalledAt(d ? toYmd(d) : "")}
            />
            <DatePickerInput
              id="cc-due"
              label="Due Date"
              value={dueDate ? new Date(dueDate) : undefined}
              onChange={(d) => setDueDate(d ? toYmd(d) : "")}
            />
            {shareClasses.length > 0 && (
              <div className="space-y-1.5">
                <Label>Share Class</Label>
                <Select value={shareClass} onValueChange={setShareClass}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select share class" />
                  </SelectTrigger>
                  <SelectContent>
                    {shareClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name ?? sc.id}
                        {sc.current_nav != null &&
                          ` — ${fmt(sc.current_nav)} / share`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : existing ? (
                "Save"
              ) : (
                "Record"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Fund Investment Dialog ───────────────────────────────────────────────

type Fund = { id: string; name?: string | null; entity?: string | null };

function AddFundInvestmentDialog({
  open,
  onClose,
  shareholderId,
  entityUUID,
  funds,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  shareholderId: string;
  entityUUID: string;
  funds: Fund[];
  onSaved: () => void;
}) {
  const [fund, setFund] = React.useState("");
  const [committedAmount, setCommittedAmount] = React.useState("");
  const [issuedAt, setIssuedAt] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFund("");
      setCommittedAmount("");
      setIssuedAt("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cap-table-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: entityUUID,
          shareholder: shareholderId,
          committed_amount: committedAmount ? Number(committedAmount) : null,
          issued_at: issuedAt ? new Date(issuedAt).getTime() : null,
          round_label: funds.find((f) => f.id === fund)?.name ?? null,
        }),
      });
      if (!res.ok) {
        setError("Failed to create fund investment.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Fund Investment</DialogTitle>
            <DialogDescription>
              Create a new commitment entry for this investor.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            {funds.length > 0 && (
              <div className="space-y-1.5">
                <Label>Fund</Label>
                <Select value={fund} onValueChange={setFund}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select fund (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {funds.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name ?? f.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="fi-amount">Committed Amount</Label>
              <Input
                id="fi-amount"
                type="number"
                min="0"
                step="0.01"
                value={committedAmount}
                onChange={(e) => setCommittedAmount(e.target.value)}
                required
              />
            </div>
            <DatePickerInput
              id="fi-date"
              label="Commitment Date"
              value={issuedAt ? new Date(issuedAt) : undefined}
              onChange={(d) => setIssuedAt(d ? toYmd(d) : "")}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export function InvestorSheet({
  open,
  onOpenChange,
  shareholder,
  entityUUID,
  funds,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shareholder: CapTableShareholder | null;
  entityUUID: string;
  funds: Fund[];
  onUpdated?: () => void;
}) {
  // Nested fund children already loaded from the cap table shareholders response
  const fundChildren: CapTableFundChild[] = shareholder?._parent_shareholder ?? [];

  const [entries, setEntries] = React.useState<CapTableEntry[]>([]);
  const [capitalCalls, setCapitalCalls] = React.useState<CapitalCall[]>([]);
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Edit profile state
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  // Dialogs
  const [ccDialog, setCcDialog] = React.useState<{
    open: boolean;
    entryId: string;
    existing: CapitalCall | null;
  }>({ open: false, entryId: "", existing: null });
  const [addFundDialog, setAddFundDialog] = React.useState(false);
  const [sendingEmail, setSendingEmail] = React.useState(false);

  async function load() {
    if (!shareholder) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cap-table-shareholders/${shareholder.id}`);
      if (!res.ok) return;
      const sh: CapTableShareholder = await res.json();

      const myEntries: CapTableEntry[] = sh._cap_table_entry ?? [];
      const allCalls: CapitalCall[] = myEntries.flatMap((e) => e._capital_call ?? []);
      const scMap = new Map<string, ShareClass>();
      for (const call of allCalls) {
        if (call._share_class) scMap.set(call._share_class.id, call._share_class as unknown as ShareClass);
      }

      setEntries(myEntries);
      setCapitalCalls(allCalls);
      setShareClasses(Array.from(scMap.values()));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (open && shareholder) {
      setName(shareholder.name ?? "");
      setEmail(shareholder.email ?? "");
      setNotes(shareholder.notes ?? "");
      setProfileError(null);
      void load();
    }
  }, [open, shareholder?.id]);

  async function saveProfile() {
    if (!shareholder) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch(`/api/cap-table-shareholders/${shareholder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          email: email || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        setProfileError("Failed to save.");
        return;
      }
      onUpdated?.();
    } finally {
      setSavingProfile(false);
    }
  }

  async function sendEmail() {
    if (!shareholder?.email) return;
    setSendingEmail(true);
    try {
      await fetch(`/api/cap-table-shareholders/${shareholder.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: "the asset manager" }),
      });
    } finally {
      setSendingEmail(false);
    }
  }

  async function deleteCapitalCall(id: string) {
    if (!confirm("Delete this capital call?")) return;
    await fetch(`/api/capital-calls/${id}`, { method: "DELETE" });
    void load();
  }

  if (!shareholder) return null;

  // Prefer nested fund data for stats (already loaded in parent)
  const useNested = fundChildren.length > 0;
  const allNestedCalls = fundChildren.flatMap((ch) =>
    (ch._cap_table_entry ?? []).flatMap((e) => e._capital_call ?? []),
  );
  const totalCommitted = useNested
    ? fundChildren.reduce(
        (s, ch) => s + (ch._cap_table_entry?.[0]?.committed_amount ?? 0),
        0,
      )
    : entries.reduce((s, e) => s + (e.committed_amount ?? 0), 0);
  const totalCalled = useNested
    ? allNestedCalls.reduce((s, c) => s + (c.amount ?? 0), 0)
    : capitalCalls.reduce((s, c) => s + (c.amount ?? 0), 0);
  const uncalled = Math.max(0, totalCommitted - totalCalled);
  const paidIn = useNested
    ? allNestedCalls.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount ?? 0), 0)
    : capitalCalls.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto w-[90vw]! p-0">
        <div className="flex flex-col">
          <SheetHeader className="shrink-0 px-4 pt-4 pb-3 border-b">
            <SheetTitle>{shareholder.name ?? "Investor"}</SheetTitle>
            <SheetDescription>
              {shareholder.email ?? "No email on file"}
            </SheetDescription>
          </SheetHeader>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-px border-b bg-border">
            {[
              { label: "Committed", value: fmt(totalCommitted) },
              { label: "Called", value: fmt(totalCalled) },
              {
                label: "Uncalled",
                value: uncalled > 0 ? fmt(uncalled) : "—",
                className: uncalled > 0 ? "text-amber-600" : "",
              },
              { label: "Paid in", value: fmt(paidIn), className: "text-green-600" },
            ].map(({ label, value, className }) => (
              <div key={label} className="bg-background px-4 py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-0.5 text-sm font-semibold tabular-nums ${className ?? ""}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex-1 px-4 pb-4">
            <Tabs defaultValue="commitments" className="mt-4">
              <TabsList className="w-full justify-start gap-1 overflow-x-auto whitespace-nowrap">
                <TabsTrigger className="px-3" value="commitments">
                  Commitments
                </TabsTrigger>
                <TabsTrigger className="px-3" value="profile">
                  Profile
                </TabsTrigger>
                <TabsTrigger className="px-3" value="documents">
                  Documents
                </TabsTrigger>
                <TabsTrigger className="px-3" value="outreach">
                  Outreach
                </TabsTrigger>
              </TabsList>

              {/* ── Commitments tab ── */}
              <TabsContent value="commitments" className="mt-4">
                {/* Fund position cards from nested data */}
                {useNested && (
                  <div className="flex flex-col gap-3 mb-4">
                    {fundChildren.map((ch) => {
                      const chEntry = ch._cap_table_entry?.[0] ?? null;
                      const chCalls = chEntry?._capital_call ?? [];
                      const chCalled = chCalls.reduce((s, c) => s + (c.amount ?? 0), 0);
                      const chUncalled = Math.max(0, (chEntry?.committed_amount ?? 0) - chCalled);
                      const chPaid = chCalls.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount ?? 0), 0);
                      const fundMatch = funds.find((f) => f.entity === ch.entity);
                      const fundName = fundMatch?.name ?? ch._entity?._fund?.name ?? "Fund";
                      const allPaid = chCalls.length > 0 && chCalls.every((c) => c.status === "paid");
                      const anyPartial = chCalls.some((c) => c.status === "partial");
                      const anyPending = chCalls.some((c) => c.status === "pending");
                      const callStatus = allPaid ? "paid" : anyPartial ? "partial" : anyPending ? "pending" : null;
                      return (
                        <div key={ch.id} className="rounded-md border overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b">
                            <div>
                              <p className="text-sm font-medium">{fundName}</p>
                              <p className="text-xs text-muted-foreground">
                                Committed: {fmt(chEntry?.committed_amount)}
                                {chCalls.length > 0 && ` · ${chCalls.length} call${chCalls.length !== 1 ? "s" : ""}`}
                              </p>
                            </div>
                            {callStatus && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  callStatus === "paid"
                                    ? "bg-green-100 text-green-700"
                                    : callStatus === "partial"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 divide-x text-xs">
                            <div className="px-3 py-2">
                              <p className="text-muted-foreground">Called</p>
                              <p className="font-medium tabular-nums mt-0.5">{fmt(chCalled)}</p>
                            </div>
                            <div className="px-3 py-2">
                              <p className="text-muted-foreground">Uncalled</p>
                              <p className={`font-medium tabular-nums mt-0.5 ${chUncalled > 0 ? "text-amber-600" : ""}`}>
                                {chUncalled > 0 ? fmt(chUncalled) : "—"}
                              </p>
                            </div>
                            <div className="px-3 py-2">
                              <p className="text-muted-foreground">Paid in</p>
                              <p className="font-medium tabular-nums mt-0.5 text-green-600">{fmt(chPaid)}</p>
                            </div>
                          </div>
                          {chCalls.length > 0 && (
                            <div className="border-t divide-y">
                              {chCalls.map((cc) => (
                                <div key={cc.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                  <span className="text-muted-foreground">
                                    {cc.called_at ? fmtDate(cc.called_at) : "—"}
                                  </span>
                                  <span className="tabular-nums font-medium">{fmt(cc.amount)}</span>
                                  {cc.status && (
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${CALL_STATUS_STYLES[cc.status]}`}
                                    >
                                      {CALL_STATUS_LABEL[cc.status]}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!useNested && (<>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Fund commitments</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddFundDialog(true)}
                  >
                    <Plus className="size-3.5 mr-1" /> Add commitment
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm gap-2">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : entries.length === 0 ? (
                  <div className="rounded-md border border-dashed py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      No commitments yet.
                    </p>
                    <button
                      className="text-xs text-muted-foreground underline mt-1"
                      onClick={() => setAddFundDialog(true)}
                    >
                      Add one
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {entries.map((entry) => {
                      const calls = capitalCalls.filter(
                        (c) => c.cap_table_entry === entry.id,
                      );
                      const called = calls.reduce(
                        (s, c) => s + (c.amount ?? 0),
                        0,
                      );
                      const remaining = (entry.committed_amount ?? 0) - called;
                      return (
                        <div
                          key={entry.id}
                          className="rounded-md border overflow-hidden"
                        >
                          {/* Entry header */}
                          <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b">
                            <div>
                              <p className="text-sm font-medium">
                                {entry.round_label ?? "Commitment"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Committed: {fmt(entry.committed_amount)}
                                {entry.issued_at &&
                                  ` · ${fmtDate(entry.issued_at)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{fmt(called)} called · </span>
                              <span
                                className={
                                  remaining > 0
                                    ? "text-amber-600 font-medium"
                                    : ""
                                }
                              >
                                {fmt(remaining)} remaining
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  setCcDialog({
                                    open: true,
                                    entryId: entry.id,
                                    existing: null,
                                  })
                                }
                              >
                                <Plus className="size-3 mr-1" /> Call
                              </Button>
                            </div>
                          </div>

                          {/* Capital calls */}
                          {calls.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No capital calls yet.{" "}
                              <button
                                className="underline"
                                onClick={() =>
                                  setCcDialog({
                                    open: true,
                                    entryId: entry.id,
                                    existing: null,
                                  })
                                }
                              >
                                Record one
                              </button>
                            </div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b text-muted-foreground">
                                  <th className="text-left px-3 py-1.5 font-medium">
                                    Fund / Date
                                  </th>
                                  <th className="text-left px-3 py-1.5 font-medium">
                                    Share Class
                                  </th>
                                  <th className="text-right px-3 py-1.5 font-medium">
                                    Amount
                                  </th>
                                  <th className="text-left px-3 py-1.5 font-medium">
                                    Received
                                  </th>
                                  <th className="text-left px-3 py-1.5 font-medium">
                                    Deployed
                                  </th>
                                  <th className="text-left px-3 py-1.5 font-medium">
                                    Status
                                  </th>
                                  <th className="px-3 py-1.5 w-12" />
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {calls.map((cc) => {
                                  const fundName =
                                    cc._entity?._fund?.name ??
                                    cc._entity?._company?.name ??
                                    cc._entity?._family_office?.name ??
                                    null;
                                  const sc =
                                    cc._share_class ??
                                    shareClasses.find(
                                      (s) => s.id === cc.share_class,
                                    );
                                  return (
                                    <tr
                                      key={cc.id}
                                      className="hover:bg-muted/20"
                                    >
                                      <td className="px-3 py-2">
                                        <p className="font-medium">
                                          {fundName ?? "—"}
                                        </p>
                                        {cc.called_at && (
                                          <p className="text-muted-foreground">
                                            {fmtDate(cc.called_at)}
                                          </p>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {sc ? (
                                          <>
                                            <p>{sc.name}</p>
                                            {sc.current_nav != null && (
                                              <p className="opacity-70">
                                                {fmt(sc.current_nav)} /
                                                share
                                              </p>
                                            )}
                                          </>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                                        {fmt(cc.amount)}
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {fmtDate(cc.received_at)}
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {cc.deployed_at ? fmtDate(cc.deployed_at) : "—"}
                                      </td>
                                      <td className="px-3 py-2">
                                        {cc.status && (
                                          <span
                                            className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${CALL_STATUS_STYLES[cc.status]}`}
                                          >
                                            {CALL_STATUS_LABEL[cc.status]}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-3">
                                          {cc.deployed_at ? (
                                            <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-medium">Deployed</span>
                                          ) : (
                                            <CapitalCallReceive
                                              capitalCall={cc}
                                              entityUUID={cc.entity}
                                              label="Deploy to Fund"
                                              onSuccess={load}
                                            />
                                          )}
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() =>
                                                setCcDialog({
                                                  open: true,
                                                  entryId: entry.id,
                                                  existing: cc,
                                                })
                                              }
                                              className="text-muted-foreground hover:text-foreground"
                                            >
                                              <Pencil className="size-3" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                deleteCapitalCall(cc.id)
                                              }
                                              className="text-muted-foreground hover:text-destructive"
                                            >
                                              <Trash2 className="size-3" />
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                </>)}
              </TabsContent>

              {/* ── Profile tab ── */}
              <TabsContent value="profile" className="mt-4">
                <div className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-name">Name</Label>
                    <Input
                      id="inv-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-email">Email</Label>
                    <Input
                      id="inv-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-notes">Notes</Label>
                    <textarea
                      id="inv-notes"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-24 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  {profileError && (
                    <p className="text-xs text-destructive">{profileError}</p>
                  )}
                  <Button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="self-start"
                  >
                    {savingProfile ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* ── Documents tab ── */}
              <TabsContent value="documents" className="mt-4">
                <ShareholderDocumentsTab
                  shareholderId={shareholder.id}
                  entityUUID={entityUUID}
                />
              </TabsContent>

              {/* ── Outreach tab ── */}
              <TabsContent value="outreach" className="mt-4">
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Portal invite</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Send an email inviting this investor to the investor
                        portal.
                      </p>
                      {shareholder.invited_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last sent: {fmtDate(shareholder.invited_at)}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!shareholder.email || sendingEmail}
                      onClick={sendEmail}
                    >
                      {sendingEmail ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="size-3.5 mr-1" />
                          {shareholder.invite_sent
                            ? "Resend invite"
                            : "Send invite"}
                        </>
                      )}
                    </Button>
                  </div>

                  {!shareholder.email && (
                    <p className="text-xs text-muted-foreground">
                      Add an email on the Profile tab before sending outreach.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>

      <CapitalCallDialog
        open={ccDialog.open}
        onClose={() =>
          setCcDialog({ open: false, entryId: "", existing: null })
        }
        entityUUID={entityUUID}
        entryId={ccDialog.entryId}
        existing={ccDialog.existing}
        onSaved={load}
        committedAmount={
          entries.find((e) => e.id === ccDialog.entryId)?.committed_amount ??
          null
        }
        alreadyCalled={capitalCalls
          .filter(
            (c) =>
              c.cap_table_entry === ccDialog.entryId &&
              c.id !== ccDialog.existing?.id,
          )
          .reduce((s, c) => s + (c.amount ?? 0), 0)}
        shareClasses={shareClasses}
      />

      <AddFundInvestmentDialog
        open={addFundDialog}
        onClose={() => setAddFundDialog(false)}
        shareholderId={shareholder.id}
        entityUUID={entityUUID}
        funds={funds}
        onSaved={load}
      />
    </Sheet>
  );
}
