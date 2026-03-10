"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Shield,
  Mail,
  MailCheck,
} from "lucide-react";
import {
  fetchShareClasses,
  fetchCapTableShareholders,
  fetchCapTableEntries,
  fetchCapitalCalls,
  type ShareClass,
  type CapTableShareholder,
  type CapTableEntry,
  type CapitalCall,
} from "@/lib/cap-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { DatePickerInput } from "@/components/date-input";
import { CapitalCallReceive } from "@/components/capital-call-receive";

// ─── helpers ────────────────────────────────────────────────────────────────

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtCurrency(n: number | null | undefined, currencyCode = "EUR") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function callEntityName(cc: CapitalCall): string | null {
  const e = cc._entity;
  if (!e) return null;
  return e._fund?.name ?? e._company?.name ?? e._family_office?.name ?? null;
}

// ─── Add/Edit Shareholder Dialog ─────────────────────────────────────────────

type ShareholderForm = {
  name: string;
  type: string;
  is_ubo: boolean;
  ubo_percentage: string;
  country: string;
  email: string;
  notes: string;
};

const BLANK_SH: ShareholderForm = {
  name: "",
  type: "individual",
  is_ubo: false,
  ubo_percentage: "",
  country: "",
  email: "",
  notes: "",
};

type Country = { id: number; name: string };

function ShareholderDialog({
  open,
  onClose,
  entityUUID,
  existing,
  onSaved,
  defaultCountryId,
}: {
  open: boolean;
  onClose: () => void;
  entityUUID: string;
  existing: CapTableShareholder | null;
  onSaved: () => void;
  defaultCountryId?: number | null;
}) {
  const [form, setForm] = React.useState<ShareholderForm>(BLANK_SH);
  const [countries, setCountries] = React.useState<Country[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      fetch("/api/countries")
        .then((r) => (r.ok ? r.json() : []))
        .then(setCountries)
        .catch(() => {});
      setError(null);
      setForm(
        existing
          ? {
              name: existing.name ?? "",
              type: existing.type ?? "individual",
              is_ubo: existing.is_ubo ?? false,
              ubo_percentage:
                existing.ubo_percentage != null
                  ? String(existing.ubo_percentage)
                  : "",
              country: existing.country != null ? String(existing.country) : "",
              email: existing.email ?? "",
              notes: existing.notes ?? "",
            }
          : {
              ...BLANK_SH,
              country: defaultCountryId != null ? String(defaultCountryId) : "",
            },
      );
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        entity: entityUUID,
        name: form.name || null,
        type: form.type || null,
        is_ubo: form.is_ubo,
        ubo_percentage: form.ubo_percentage
          ? Number(form.ubo_percentage)
          : null,
        country: form.country ? Number(form.country) : null,
        email: form.email || null,
        notes: form.notes || null,
      };
      const url = existing
        ? `/api/cap-table-shareholders/${existing.id}`
        : `/api/cap-table-shareholders`;
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Failed to save shareholder.");
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {existing ? "Edit Shareholder" : "Add Shareholder"}
            </DialogTitle>
            <DialogDescription>
              {existing
                ? "Update shareholder details."
                : "Add a shareholder or UBO to the cap table."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="sh-name">Name</FieldLabel>
              <Input
                id="sh-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sh-type">Type</FieldLabel>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger id="sh-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="sh-ubo" className="flex items-center gap-2">
                <input
                  id="sh-ubo"
                  type="checkbox"
                  checked={form.is_ubo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_ubo: e.target.checked }))
                  }
                  className="size-4 rounded border"
                />
                Mark as UBO (Ultimate Beneficial Owner)
              </FieldLabel>
            </Field>
            {form.is_ubo && (
              <Field>
                <FieldLabel htmlFor="sh-ubo-pct">UBO Ownership %</FieldLabel>
                <Input
                  id="sh-ubo-pct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.ubo_percentage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ubo_percentage: e.target.value }))
                  }
                  placeholder="e.g. 25.00"
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Country</FieldLabel>
              <Select
                value={form.country}
                onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="sh-email">Email</FieldLabel>
              <Input
                id="sh-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Spinner className="size-4" />
              ) : existing ? (
                "Save"
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Cap Table Entry Dialog ───────────────────────────────────────────────

type EntryForm = {
  shareholder: string;
  share_class: string;
  round_label: string;
  shares_issued: string;
  price_per_share: string;
  committed_amount: string;
  issued_at: string;
};

const BLANK_ENTRY: EntryForm = {
  shareholder: "",
  share_class: "",
  round_label: "",
  shares_issued: "",
  price_per_share: "",
  committed_amount: "",
  issued_at: "",
};

function EntryDialog({
  open,
  onClose,
  entityUUID,
  shareholders,
  shareClasses,
  existing,
  onSaved,
  isCommitment = false,
}: {
  open: boolean;
  onClose: () => void;
  entityUUID: string;
  shareholders: CapTableShareholder[];
  shareClasses: ShareClass[];
  existing: CapTableEntry | null;
  onSaved: () => void;
  isCommitment?: boolean;
}) {
  const [form, setForm] = React.useState<EntryForm>(BLANK_ENTRY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setForm(
        existing
          ? {
              shareholder: existing.shareholder ?? "",
              share_class: existing.share_class ?? "",
              round_label: existing.round_label ?? "",
              shares_issued:
                existing.shares_issued != null
                  ? String(existing.shares_issued)
                  : "",
              price_per_share:
                existing.price_per_share != null
                  ? String(existing.price_per_share)
                  : "",
              committed_amount:
                existing.committed_amount != null
                  ? String(existing.committed_amount)
                  : "",
              issued_at: existing.issued_at
                ? toYmd(new Date(existing.issued_at))
                : "",
            }
          : BLANK_ENTRY,
      );
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        entity: entityUUID,
        shareholder: form.shareholder || null,
        share_class: form.share_class || null,
        round_label: form.round_label || null,
        shares_issued: form.shares_issued ? Number(form.shares_issued) : null,
        price_per_share: form.price_per_share
          ? Number(form.price_per_share)
          : null,
        committed_amount: form.committed_amount
          ? Number(form.committed_amount)
          : null,
        issued_at: form.issued_at ? new Date(form.issued_at).getTime() : null,
      };
      const url = existing
        ? `/api/cap-table-entries/${existing.id}`
        : `/api/cap-table-entries`;
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Failed to save entry.");
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{existing ? "Edit Entry" : "Add Entry"}</DialogTitle>
            <DialogDescription>
              Assign shares to a shareholder.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel>Shareholder</FieldLabel>
              <Select
                value={form.shareholder}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, shareholder: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shareholder" />
                </SelectTrigger>
                <SelectContent>
                  {shareholders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name ?? s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!isCommitment && (
              <Field>
                <FieldLabel>Share Class</FieldLabel>
                <Select
                  value={form.share_class}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, share_class: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select share class" />
                  </SelectTrigger>
                  <SelectContent>
                    {shareClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name ?? sc.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="entry-round">Round</FieldLabel>
              <Input
                id="entry-round"
                placeholder="e.g. Seed, Series A"
                value={form.round_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, round_label: e.target.value }))
                }
              />
            </Field>
            {!isCommitment && (
              <>
                <Field>
                  <FieldLabel htmlFor="entry-shares">Shares Issued</FieldLabel>
                  <Input
                    id="entry-shares"
                    type="number"
                    min="0"
                    step="1"
                    value={form.shares_issued}
                    onChange={(e) => {
                      const shares = e.target.value;
                      setForm((f) => {
                        const price = parseFloat(f.price_per_share);
                        const committed = parseFloat(f.committed_amount);
                        const s = parseFloat(shares);
                        if (!isNaN(s) && !isNaN(price))
                          return {
                            ...f,
                            shares_issued: shares,
                            committed_amount: String(s * price),
                          };
                        if (!isNaN(s) && !isNaN(committed) && s > 0)
                          return {
                            ...f,
                            shares_issued: shares,
                            price_per_share: String(committed / s),
                          };
                        return { ...f, shares_issued: shares };
                      });
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="entry-price">Price per Share</FieldLabel>
                  <Input
                    id="entry-price"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.price_per_share}
                    onChange={(e) => {
                      const price = e.target.value;
                      setForm((f) => {
                        const shares = parseFloat(f.shares_issued);
                        const committed = parseFloat(f.committed_amount);
                        const p = parseFloat(price);
                        if (!isNaN(p) && !isNaN(shares))
                          return {
                            ...f,
                            price_per_share: price,
                            committed_amount: String(shares * p),
                          };
                        if (!isNaN(p) && !isNaN(committed) && p > 0)
                          return {
                            ...f,
                            price_per_share: price,
                            shares_issued: String(committed / p),
                          };
                        return { ...f, price_per_share: price };
                      });
                    }}
                  />
                </Field>
              </>
            )}
            <Field>
              <FieldLabel htmlFor="entry-committed">
                Committed Amount
              </FieldLabel>
              <Input
                id="entry-committed"
                type="number"
                min="0"
                step="0.01"
                value={form.committed_amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, committed_amount: e.target.value }))
                }
              />
            </Field>
            <DatePickerInput
              id="entry-date"
              label="Issue Date"
              value={form.issued_at ? new Date(form.issued_at) : undefined}
              onChange={(d) =>
                setForm((f) => ({ ...f, issued_at: d ? toYmd(d) : "" }))
              }
            />
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Spinner className="size-4" />
              ) : existing ? (
                "Save"
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Share Class Dialog ───────────────────────────────────────────────────

function ShareClassDialog({
  open,
  onClose,
  entityUUID,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  entityUUID: string;
  existing: ShareClass | null;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [voting, setVoting] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setName(existing?.name ?? "");
      setVoting(existing?.voting_rights ?? true);
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        entity: entityUUID,
        name: name || null,
        voting_rights: voting,
      };
      const url = existing
        ? `/api/share-classes/${existing.id}`
        : `/api/share-classes`;
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Failed to save share class.");
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
            <DialogTitle>
              {existing ? "Edit Share Class" : "New Share Class"}
            </DialogTitle>
            <DialogDescription>
              Define a class of shares for this entity.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="sc-name">Name</FieldLabel>
              <Input
                id="sc-name"
                placeholder="e.g. Ordinary, Preference A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel
                htmlFor="sc-voting"
                className="flex items-center gap-2"
              >
                <input
                  id="sc-voting"
                  type="checkbox"
                  checked={voting}
                  onChange={(e) => setVoting(e.target.checked)}
                  className="size-4 rounded border"
                />
                Voting rights
              </FieldLabel>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Spinner className="size-4" />
              ) : existing ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  currencyCode = "EUR",
  isCommitment = false,
  shareClasses = [],
}: {
  open: boolean;
  onClose: () => void;
  entityUUID: string;
  entryId: string;
  existing: CapitalCall | null;
  onSaved: () => void;
  committedAmount: number | null;
  alreadyCalled: number;
  currencyCode?: string;
  isCommitment?: boolean;
  shareClasses?: ShareClass[];
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
      const body = {
        entity: entityUUID,
        cap_table_entry: entryId,
        amount: amount ? Number(amount) : null,
        status,
        called_at: calledAt ? new Date(calledAt).getTime() : null,
        due_date: dueDate ? new Date(dueDate).getTime() : null,
        ...(isCommitment && {
          share_class: shareClass || null,
        }),
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
              Record a drawdown against this share entry.
            </DialogDescription>
          </DialogHeader>
          {committedAmount != null && (
            <div className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Committed</span>
                <span className="tabular-nums font-medium">
                  {fmtCurrency(committedAmount, currencyCode)}
                </span>
              </div>
              {alreadyCalled > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Previously called
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    −{fmtCurrency(alreadyCalled, currencyCode)}
                  </span>
                </div>
              )}
              {(() => {
                const thisCall = parseFloat(amount) || 0;
                const remaining = committedAmount - alreadyCalled - thisCall;
                const isOverdrawn = remaining < 0;
                return (
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-muted-foreground">Remaining</span>
                    <span
                      className={`tabular-nums font-medium ${isOverdrawn ? "text-destructive" : ""}`}
                    >
                      {fmtCurrency(remaining, currencyCode)}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="cc-amount">Amount</FieldLabel>
              <Input
                id="cc-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Defaults to the full remaining committed amount. Reduce to issue
                a partial call, or call the full amount now and record further
                calls later.
              </p>
            </Field>
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
            {isCommitment && shareClasses.length > 0 && (
              <Field>
                <FieldLabel>Share Class</FieldLabel>
                <Select value={shareClass} onValueChange={setShareClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select share class (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {shareClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name ?? sc.id}
                        {sc.price_per_share != null &&
                          ` — ${sc.price_per_share}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Spinner className="size-4" />
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

// ─── Main Component ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
};

export function CapTableManager({
  entityUUID,
  defaultCountryId,
  entityName,
  currencyCode = "EUR",
  variant = "equity",
}: {
  entityUUID: string;
  defaultCountryId?: number | null;
  entityName?: string;
  currencyCode?: string;
  variant?: "equity" | "commitment";
}) {
  const isCommitment = variant === "commitment";
  const [shareholders, setShareholders] = React.useState<CapTableShareholder[]>(
    [],
  );
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([]);
  const [entries, setEntries] = React.useState<CapTableEntry[]>([]);
  const [capitalCalls, setCapitalCalls] = React.useState<CapitalCall[]>([]);
  const [countries, setCountries] = React.useState<Country[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nav, setNav] = React.useState<number | null>(null);
  const [navLoading, setNavLoading] = React.useState(true);
  const [expandedEntries, setExpandedEntries] = React.useState<Set<string>>(
    new Set(),
  );

  // Dialogs
  const [shDialog, setShDialog] = React.useState<{
    open: boolean;
    existing: CapTableShareholder | null;
  }>({ open: false, existing: null });
  const [entryDialog, setEntryDialog] = React.useState<{
    open: boolean;
    existing: CapTableEntry | null;
  }>({ open: false, existing: null });
  const [scDialog, setScDialog] = React.useState<{
    open: boolean;
    existing: ShareClass | null;
  }>({ open: false, existing: null });
  const [ccDialog, setCcDialog] = React.useState<{
    open: boolean;
    entryId: string;
    existing: CapitalCall | null;
  }>({ open: false, entryId: "", existing: null });
  const [inviting, setInviting] = React.useState<Set<string>>(new Set());

  async function sendInvite(sh: CapTableShareholder) {
    setInviting((prev) => new Set(prev).add(sh.id));
    try {
      const res = await fetch(`/api/cap-table-shareholders/${sh.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: entityName ?? "the entity" }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Failed to send invite");
        return;
      }
      // Optimistically stamp invited_at + invite_sent so the icon updates without a reload
      setShareholders((prev) =>
        prev.map((s) =>
          s.id === sh.id
            ? { ...s, invited_at: Date.now(), invite_sent: true }
            : s,
        ),
      );
    } finally {
      setInviting((prev) => {
        const next = new Set(prev);
        next.delete(sh.id);
        return next;
      });
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [sh, sc, en, cc, cou] = await Promise.all([
        fetchCapTableShareholders(entityUUID),
        fetchShareClasses(entityUUID),
        fetchCapTableEntries(entityUUID),
        fetchCapitalCalls(entityUUID),
        fetch("/api/countries").then((r) => (r.ok ? r.json() : [])),
      ]);
      // Exclude investor-role shareholders from AM cap table (they appear in Investors tab)
      const nonInvestorSh = sh.filter((s) => s.role !== "investor");
      const nonInvestorShIds = new Set(nonInvestorSh.map((s) => s.id));
      const nonInvestorEntries = en.filter(
        (e) => !e.shareholder || nonInvestorShIds.has(e.shareholder),
      );
      const nonInvestorEntryIds = new Set(nonInvestorEntries.map((e) => e.id));
      // Merge addon calls from entries (fund-scoped) with entity-scoped calls
      const addonCalls = nonInvestorEntries.flatMap(
        (e) => e._capital_call ?? [],
      );
      const entityCallIds = new Set(cc.map((c) => c.id));
      const mergedCalls = [
        ...cc.filter(
          (c) =>
            !c.cap_table_entry || nonInvestorEntryIds.has(c.cap_table_entry),
        ),
        ...addonCalls.filter((c) => !entityCallIds.has(c.id)),
      ];
      setShareholders(nonInvestorSh);
      setShareClasses(sc);
      setEntries(nonInvestorEntries);
      setCapitalCalls(mergedCalls);
      setCountries(cou);
    } finally {
      setLoading(false);
    }
    // Fetch NAV separately (slower — hits live market prices)
    setNavLoading(true);
    try {
      const params = new URLSearchParams({ entityUUID });
      if (currencyCode) params.set("baseCurrency", currencyCode);
      const res = await fetch(`/api/net-worth?${params}`);
      if (res.ok) {
        const data = (await res.json()) as { netWorth?: number };
        setNav(typeof data.netWorth === "number" ? data.netWorth : null);
      }
    } finally {
      setNavLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, [entityUUID]);

  const totalShares = entries.reduce((s, e) => s + (e.shares_issued ?? 0), 0);
  const totalCommitted = entries.reduce(
    (s, e) => s + (e.committed_amount ?? 0),
    0,
  );
  const totalCalled = capitalCalls.reduce((s, c) => s + (c.amount ?? 0), 0);
  const impliedPricePerShare =
    nav !== null && totalShares > 0 ? nav / totalShares : null;

  function shareholderName(id: string | null) {
    return shareholders.find((s) => s.id === id)?.name ?? "—";
  }
  function shareClassName(id: string | null) {
    return shareClasses.find((s) => s.id === id)?.name ?? "—";
  }
  function countryName(id: number | null) {
    return countries.find((c) => c.id === id)?.name ?? "—";
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/cap-table-entries/${id}`, { method: "DELETE" });
    void load();
  }
  async function deleteShareholder(id: string) {
    if (
      !confirm(
        "Delete this shareholder? Any cap table entries will also be deleted.",
      )
    )
      return;
    const res = await fetch(`/api/cap-table-shareholders/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete shareholder.");
      return;
    }
    void load();
  }
  async function deleteCapitalCall(id: string) {
    if (!confirm("Delete this capital call?")) return;
    await fetch(`/api/capital-calls/${id}`, { method: "DELETE" });
    void load();
  }
  async function deleteShareClass(id: string) {
    if (!confirm("Delete this share class?")) return;
    await fetch(`/api/share-classes/${id}`, { method: "DELETE" });
    void load();
  }

  function toggleEntry(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Shareholders", value: String(shareholders.length) },
            { label: "Total Shares", value: fmt(totalShares, 0) },
            {
              label: "Committed",
              value: fmtCurrency(totalCommitted, currencyCode),
            },
            { label: "Called", value: fmtCurrency(totalCalled, currencyCode) },
            {
              label: "Current NAV",
              value: navLoading ? "…" : fmtCurrency(nav, currencyCode),
            },
            {
              label: "Implied Price / Share",
              value: navLoading
                ? "…"
                : fmtCurrency(impliedPricePerShare, currencyCode),
            },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Share Classes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Share Classes</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScDialog({ open: true, existing: null })}
            >
              <Plus className="size-3.5 mr-1" /> New Class
            </Button>
          </CardHeader>
          <CardContent>
            {shareClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No share classes defined yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shareClasses.map((sc) => (
                  <div
                    key={sc.id}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span className="font-medium">{sc.name ?? "—"}</span>
                    {sc.voting_rights && (
                      <Badge variant="secondary" className="text-xs py-0">
                        Voting
                      </Badge>
                    )}
                    <button
                      onClick={() => setScDialog({ open: true, existing: sc })}
                      className="text-muted-foreground hover:text-foreground ml-1"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => deleteShareClass(sc.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cap Table Entries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Cap Table</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShDialog({ open: true, existing: null })}
              >
                <Plus className="size-3.5 mr-1" /> Shareholder
              </Button>
              <Button
                size="sm"
                onClick={() => setEntryDialog({ open: true, existing: null })}
              >
                <Plus className="size-3.5 mr-1" /> Entry
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">
                No entries yet. Add shareholders and share issuances above.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-4 font-medium w-6"></th>
                    <th className="text-left py-2 px-4 font-medium">
                      Shareholder
                    </th>
                    {!isCommitment && (
                      <th className="text-left py-2 px-4 font-medium">Class</th>
                    )}
                    <th className="text-left py-2 px-4 font-medium">Round</th>
                    {!isCommitment && (
                      <th className="text-right py-2 px-4 font-medium">
                        Shares
                      </th>
                    )}
                    {!isCommitment && (
                      <th className="text-right py-2 px-4 font-medium">
                        Price
                      </th>
                    )}
                    <th className="text-right py-2 px-4 font-medium">
                      Committed
                    </th>
                    <th className="text-right py-2 px-4 font-medium">
                      Ownership %
                    </th>
                    <th className="text-right py-2 px-4 font-medium">
                      Current Value
                    </th>
                    <th className="text-right py-2 px-4 font-medium">G/L</th>
                    <th className="py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const sh = shareholders.find(
                      (s) => s.id === entry.shareholder,
                    );
                    const callsForEntry = capitalCalls.filter(
                      (c) => c.cap_table_entry === entry.id,
                    );
                    const calledTotal = callsForEntry.reduce(
                      (s, c) => s + (c.amount ?? 0),
                      0,
                    );
                    const ownership =
                      totalShares > 0 && entry.shares_issued
                        ? ((entry.shares_issued / totalShares) * 100).toFixed(2)
                        : "—";
                    const ownershipFrac =
                      totalShares > 0 && entry.shares_issued
                        ? entry.shares_issued / totalShares
                        : null;
                    const currentValue =
                      nav !== null && ownershipFrac !== null
                        ? ownershipFrac * nav
                        : null;
                    const gl =
                      currentValue !== null && entry.committed_amount != null
                        ? currentValue - entry.committed_amount
                        : null;
                    const expanded = expandedEntries.has(entry.id);
                    const canCall = !!sh?.user;
                    return (
                      <React.Fragment key={entry.id}>
                        <tr className="border-b hover:bg-muted/30">
                          <td className="py-2 px-4">
                            <button
                              onClick={() => toggleEntry(entry.id)}
                              className="text-muted-foreground"
                            >
                              {expanded ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </button>
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1.5">
                              <span>{shareholderName(entry.shareholder)}</span>
                              {sh?.is_ubo && (
                                <span title="UBO">
                                  <Shield className="size-3 text-amber-500" />
                                </span>
                              )}
                            </div>
                          </td>
                          {!isCommitment && (
                            <td className="py-2 px-4 text-muted-foreground">
                              {shareClassName(entry.share_class)}
                            </td>
                          )}
                          <td className="py-2 px-4 text-muted-foreground">
                            {entry.round_label ?? "—"}
                          </td>
                          {!isCommitment && (
                            <>
                              <td className="py-2 px-4 text-right tabular-nums">
                                {fmt(entry.shares_issued, 0)}
                              </td>
                              <td className="py-2 px-4 text-right tabular-nums">
                                {fmtCurrency(
                                  entry.price_per_share,
                                  currencyCode,
                                )}
                              </td>
                            </>
                          )}
                          <td className="py-2 px-4 text-right tabular-nums">
                            <div className="flex flex-col items-end">
                              <span>
                                {fmtCurrency(
                                  entry.committed_amount,
                                  currencyCode,
                                )}
                              </span>
                              {calledTotal > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {fmtCurrency(calledTotal, currencyCode)}{" "}
                                  called
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right tabular-nums">
                            {ownership}%
                          </td>
                          <td className="py-2 px-4 text-right tabular-nums">
                            {navLoading
                              ? "…"
                              : fmtCurrency(currentValue, currencyCode)}
                          </td>
                          <td className="py-2 px-4 text-right tabular-nums">
                            {navLoading ? (
                              "…"
                            ) : gl === null ? (
                              "—"
                            ) : (
                              <span
                                className={
                                  gl >= 0
                                    ? "text-emerald-600"
                                    : "text-destructive"
                                }
                              >
                                {gl >= 0 ? "+" : ""}
                                {fmtCurrency(gl, currencyCode)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() =>
                                  canCall &&
                                  setCcDialog({
                                    open: true,
                                    entryId: entry.id,
                                    existing: null,
                                  })
                                }
                                disabled={!canCall}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                                title={
                                  canCall
                                    ? "Record capital call"
                                    : "Shareholder must sign up before a capital call can be issued"
                                }
                              >
                                <Plus className="size-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setEntryDialog({
                                    open: true,
                                    existing: entry,
                                  })
                                }
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded &&
                          callsForEntry.length > 0 &&
                          callsForEntry.map((cc) => (
                            <tr
                              key={cc.id}
                              className="bg-muted/20 border-b text-xs"
                            >
                              <td></td>
                              <td
                                colSpan={2}
                                className="py-1.5 px-4 pl-8 text-muted-foreground"
                              >
                                <div>
                                  {callEntityName(cc) ?? "Capital call"}
                                  {cc.called_at
                                    ? ` — ${fmtDate(cc.called_at)}`
                                    : cc.status === "pending"
                                      ? " (pending)"
                                      : ""}
                                </div>
                                {isCommitment &&
                                  cc.share_class &&
                                  (() => {
                                    const sc = shareClasses.find(
                                      (s) => s.id === cc.share_class,
                                    );
                                    return sc ? (
                                      <div className="text-xs opacity-70">
                                        {sc.name}
                                        {sc.price_per_share != null &&
                                          ` — ${fmtCurrency(sc.price_per_share, currencyCode)} / share`}
                                      </div>
                                    ) : null;
                                  })()}
                              </td>
                              {!isCommitment && <td></td>}
                              {!isCommitment && <td></td>}
                              {!isCommitment && <td></td>}
                              <td className="py-1.5 px-4 text-right tabular-nums">
                                {fmtCurrency(cc.amount, currencyCode)}
                              </td>
                              <td className="py-1.5 px-4 text-right">
                                <span
                                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${cc.status === "paid" && cc.received_at ? "bg-emerald-100 text-emerald-800" : STATUS_BADGE[cc.status ?? "pending"]}`}
                                >
                                  {cc.status === "paid" && cc.received_at
                                    ? "settled"
                                    : (cc.status ?? "pending")}
                                </span>
                              </td>
                              <td className="py-1.5 px-4">
                                <div className="flex items-center gap-1 justify-end">
                                  {cc.status === "paid" && !cc.received_at && (
                                    <CapitalCallReceive
                                      capitalCall={cc}
                                      entityUUID={entityUUID}
                                      currencyCode={currencyCode}
                                      onSuccess={load}
                                    />
                                  )}
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
                                    onClick={() => deleteCapitalCall(cc.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {expanded && callsForEntry.length === 0 && (
                          <tr className="bg-muted/20 border-b">
                            <td></td>
                            <td
                              colSpan={isCommitment ? 7 : 10}
                              className="py-2 px-4 pl-8 text-xs text-muted-foreground"
                            >
                              {canCall ? (
                                <>
                                  No capital calls recorded.{" "}
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
                                </>
                              ) : (
                                <>
                                  No capital calls recorded. Shareholder must
                                  sign up before a call can be issued.
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t text-xs font-medium">
                    <td
                      colSpan={isCommitment ? 2 : 4}
                      className="py-2 px-4 text-muted-foreground"
                    >
                      Total
                    </td>
                    {isCommitment && <td></td>}
                    {!isCommitment && (
                      <>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {fmt(totalShares, 0)}
                        </td>
                        <td></td>
                      </>
                    )}
                    <td className="py-2 px-4 text-right tabular-nums">
                      {fmtCurrency(totalCommitted, currencyCode)}
                    </td>
                    <td className="py-2 px-4 text-right">100%</td>
                    <td className="py-2 px-4 text-right tabular-nums">
                      {navLoading ? "…" : fmtCurrency(nav, currencyCode)}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums">
                      {navLoading ? (
                        "…"
                      ) : nav !== null && totalCommitted > 0 ? (
                        <span
                          className={
                            nav - totalCommitted >= 0
                              ? "text-emerald-600"
                              : "text-destructive"
                          }
                        >
                          {nav - totalCommitted >= 0 ? "+" : ""}
                          {fmtCurrency(nav - totalCommitted, currencyCode)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Shareholders list */}
        {shareholders.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Shareholders</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShDialog({ open: true, existing: null })}
              >
                <Plus className="size-3.5 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-4 font-medium">Name</th>
                    <th className="text-left py-2 px-4 font-medium">Type</th>
                    <th className="text-left py-2 px-4 font-medium">UBO</th>
                    <th className="text-left py-2 px-4 font-medium">
                      Nationality
                    </th>
                    <th className="text-left py-2 px-4 font-medium">Email</th>
                    <th className="py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {shareholders.map((sh) => (
                    <tr key={sh.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-4 font-medium">
                        {sh.name ?? "—"}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground capitalize">
                        {sh.type ?? "—"}
                      </td>
                      <td className="py-2 px-4">
                        {sh.is_ubo ? (
                          <div className="flex items-center gap-1">
                            <Shield className="size-3.5 text-amber-500" />
                            <span className="text-xs">
                              {sh.ubo_percentage != null
                                ? `${sh.ubo_percentage}%`
                                : "Yes"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">
                        {countryName(sh.country)}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">
                        {sh.email ?? "—"}
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          {sh.email && (
                            <button
                              onClick={() => sendInvite(sh)}
                              disabled={inviting.has(sh.id)}
                              title={
                                sh.invite_sent
                                  ? `Invited${sh.invited_at ? ` ${new Date(sh.invited_at).toLocaleDateString()}` : ""}`
                                  : "Send invite"
                              }
                              className={
                                sh.invite_sent
                                  ? "text-green-600"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                            >
                              {sh.invite_sent ? (
                                <MailCheck className="size-3.5" />
                              ) : (
                                <Mail className="size-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setShDialog({ open: true, existing: sh })
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => deleteShareholder(sh.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <ShareholderDialog
        open={shDialog.open}
        onClose={() => setShDialog({ open: false, existing: null })}
        entityUUID={entityUUID}
        existing={shDialog.existing}
        onSaved={load}
        defaultCountryId={defaultCountryId}
      />
      <EntryDialog
        open={entryDialog.open}
        onClose={() => setEntryDialog({ open: false, existing: null })}
        entityUUID={entityUUID}
        shareholders={shareholders}
        shareClasses={shareClasses}
        existing={entryDialog.existing}
        onSaved={load}
        isCommitment={isCommitment}
      />
      <ShareClassDialog
        open={scDialog.open}
        onClose={() => setScDialog({ open: false, existing: null })}
        entityUUID={entityUUID}
        existing={scDialog.existing}
        onSaved={load}
      />
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
        currencyCode={currencyCode}
        isCommitment={isCommitment}
        shareClasses={shareClasses}
      />
    </div>
  );
}
