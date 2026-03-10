"use client";

import * as React from "react";
import {
  Loader2,
  Upload,
  X,
  AlertCircle,
  Check,
  FileText,
  ExternalLink,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  type ComplianceRecord,
  STATUS_LABELS,
  STATUS_COLORS as COMPLIANCE_STATUS_COLORS,
} from "@/components/add-compliance-dialog";
import { ComplianceSheet } from "@/components/compliance-sheet";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Address = {
  street?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

type InterestItem = {
  fund?: string | null;
  share_class?: string | null;
  committed_amount?: number | null;
};

export type LeadRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status?: string | null;
  notes?: string | null;
  address?: Address | null;
  interests?: InterestItem[] | null;
  investor_classification?: string | null;
  referrer_email?: string | null;
  created_at?: number | null;
};

type Fund = { id: string; name?: string | null; entity?: string | null };
type ShareClass = { id: string; name?: string | null };

type Document = {
  id: string;
  name?: string | null;
  file?: { url?: string; name?: string; size?: number; mime?: string } | null;
  created_at?: number | null;
};

const STATUSES = [
  "lead",
  "prospect",
  "qualified",
  "onboarding",
  "investor",
] as const;

const INVESTOR_CLASSIFICATIONS = [
  { value: "retail", label: "Retail" },
  { value: "professional", label: "Professional" },
  { value: "institutional", label: "Institutional" },
];

const STATUS_COLORS: Record<string, string> = {
  lead: "text-slate-600 dark:text-slate-400",
  prospect: "text-blue-600 dark:text-blue-400",
  qualified: "text-amber-600 dark:text-amber-400",
  onboarding: "text-purple-600 dark:text-purple-400",
  investor: "text-green-600 dark:text-green-400",
};

// ── Overview Tab ──────────────────────────────────────────────────────────────

function qualificationGateItems(
  status: string,
  originalStatus: string | null | undefined,
  interests: InterestItem[] | null | undefined,
  investorClassification: string,
): string[] {
  // Only gate when actively moving *to* qualified from a non-qualified status
  if (status !== "qualified" || originalStatus === "qualified") return [];
  const missing: string[] = [];
  const hasFund = (interests ?? []).some((i) => !!i.fund);
  const hasAmount = (interests ?? []).some(
    (i) => i.committed_amount != null && i.committed_amount > 0,
  );
  if (!hasFund) missing.push("At least one fund interest must be selected");
  if (!hasAmount) missing.push("At least one committed amount must be set");
  if (!investorClassification) missing.push("Investor classification must be set");
  return missing;
}

function OverviewTab({
  lead,
  onUpdated,
}: {
  lead: LeadRecord;
  onUpdated: (updated: LeadRecord) => void;
}) {
  const [name, setName] = React.useState(lead.name ?? "");
  const [email, setEmail] = React.useState(lead.email ?? "");
  const [phone, setPhone] = React.useState(lead.phone ?? "");
  const [company, setCompany] = React.useState(lead.company ?? "");
  const [status, setStatus] = React.useState(lead.status ?? "lead");
  const [investorClassification, setInvestorClassification] = React.useState(
    lead.investor_classification ?? "",
  );
  const [notes, setNotes] = React.useState(lead.notes ?? "");
  const [street, setStreet] = React.useState(lead.address?.street ?? "");
  const [line2, setLine2] = React.useState(lead.address?.line2 ?? "");
  const [city, setCity] = React.useState(lead.address?.city ?? "");
  const [state, setState] = React.useState(lead.address?.state ?? "");
  const [zip, setZip] = React.useState(lead.address?.zip ?? "");
  const [country, setCountry] = React.useState(lead.address?.country ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const gateItems = qualificationGateItems(status, lead.status, lead.interests, investorClassification);
  const gateFails = gateItems.length > 0;

  async function handleSave() {
    if (gateFails) return;
    setSaving(true);
    setError(null);
    const addressObj = {
      street: street.trim() || undefined,
      line2: line2.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
      country: country.trim() || undefined,
    };
    const hasAddress = Object.values(addressObj).some(Boolean);
    const body: Record<string, unknown> = {
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      status,
      investor_classification: investorClassification || undefined,
      notes: notes.trim() || undefined,
    };
    if (hasAddress) body.address = addressObj;

    const res = await fetch(`/api/investor-leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Failed to save.");
      return;
    }
    onUpdated({ ...lead, ...(data as LeadRecord) });
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <FieldGroup className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Investor classification</FieldLabel>
          <Select
            value={investorClassification}
            onValueChange={setInvestorClassification}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {INVESTOR_CLASSIFICATIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <FieldGroup className="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Phone</FieldLabel>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <Field>
          <FieldLabel>Company</FieldLabel>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
      </FieldGroup>

      <div>
        <p className="text-sm font-medium mb-3">Address</p>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Street address"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
          <Input
            placeholder="Apartment, suite, etc."
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              placeholder="State/Province"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Zip/Postal code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
            <Input
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Field>
        <FieldLabel>Notes</FieldLabel>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="resize-none"
        />
      </Field>

      {gateFails && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
            Cannot move to Qualified — requirements not met:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {gateItems.map((item) => (
              <li key={item} className="text-xs text-amber-600 dark:text-amber-500">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleSave} disabled={saving || gateFails} className="self-end">
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </div>
  );
}

// ── Interests Tab ─────────────────────────────────────────────────────────────

function InterestsTab({
  lead,
  funds,
  onUpdated,
}: {
  lead: LeadRecord;
  funds: Fund[];
  onUpdated: (updated: LeadRecord) => void;
}) {
  const [items, setItems] = React.useState<InterestItem[]>(
    lead.interests ?? [],
  );
  const [shareClassCache, setShareClassCache] = React.useState<
    Record<string, ShareClass[]>
  >({});
  const [saving, setSaving] = React.useState(false);

  async function loadShareClasses(fundEntity: string) {
    if (shareClassCache[fundEntity] !== undefined) return;
    const res = await fetch(`/api/share-classes?entity=${fundEntity}`);
    if (res.ok) {
      const data = (await res.json()) as ShareClass[];
      setShareClassCache((prev) => ({ ...prev, [fundEntity]: data }));
    }
  }

  // Preload share classes for already-selected funds
  React.useEffect(() => {
    for (const item of items) {
      if (!item.fund) continue;
      const fund = funds.find((f) => f.id === item.fund);
      if (fund?.entity) loadShareClasses(fund.entity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFundChange(index: number, fundId: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, fund: fundId || null, share_class: null }
          : item,
      ),
    );
    const fund = funds.find((f) => f.id === fundId);
    if (fund?.entity) loadShareClasses(fund.entity);
  }

  function handleShareClassChange(index: number, scId: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, share_class: scId || null } : item,
      ),
    );
  }

  function handleAmountChange(index: number, value: string) {
    const num = parseFloat(value);
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              committed_amount: value === "" || isNaN(num) ? null : num,
            }
          : item,
      ),
    );
  }

  function addRow() {
    setItems((prev) => [...prev, {}]);
  }

  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/investor-leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: items }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok)
      onUpdated({ ...lead, interests: items, ...(data as LeadRecord) });
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <p className="text-sm text-muted-foreground">
        Fund interests with committed amounts and share classes.
      </p>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No interests added yet.
        </p>
      )}

      {items.map((item, index) => {
        const fund = funds.find((f) => f.id === item.fund);
        const shareClasses = fund?.entity
          ? (shareClassCache[fund.entity] ?? [])
          : [];

        return (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <Select
                value={item.fund ?? ""}
                onValueChange={(v) => handleFundChange(index, v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Fund" />
                </SelectTrigger>
                <SelectContent>
                  {funds.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name ?? f.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={item.share_class ?? ""}
                onValueChange={(v) => handleShareClassChange(index, v)}
                disabled={!item.fund}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Share class" />
                </SelectTrigger>
                <SelectContent>
                  {shareClasses.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No share classes
                    </div>
                  ) : (
                    shareClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name ?? sc.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Committed amount"
                value={item.committed_amount ?? ""}
                onChange={(e) => handleAmountChange(index, e.target.value)}
                min={0}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              className="shrink-0 mt-0.5"
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={addRow}
        className="self-start"
      >
        <Plus className="size-3.5" />
        Add fund interest
      </Button>

      <Button onClick={handleSave} disabled={saving} className="self-end">
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          "Save interests"
        )}
      </Button>
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function DocumentsTab({
  lead,
  entityId,
}: {
  lead: LeadRecord;
  entityId: string;
}) {
  const [docs, setDocs] = React.useState<Document[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploadStatuses, setUploadStatuses] = React.useState<
    Record<string, "uploading" | "done" | "error">
  >({});
  const [queued, setQueued] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch(`/api/documents?object_type=lead&object_id=${lead.id}`)
      .then((r) => r.json())
      .then((d: { documents?: Document[] }) =>
        setDocs(Array.isArray(d.documents) ? d.documents : []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lead.id]);

  function addFiles(files: File[]) {
    setQueued((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...files.filter((f) => !existing.has(f.name))];
    });
  }

  async function handleUpload() {
    if (queued.length === 0) return;
    const statuses: Record<string, "uploading" | "done" | "error"> = {};
    for (const f of queued) statuses[f.name] = "uploading";
    setUploadStatuses({ ...statuses });

    const fd = new FormData();
    fd.append("entity", entityId);
    for (const f of queued) fd.append("files", f);

    try {
      const res = await fetch(`/api/investor-leads/${lead.id}/documents`, {
        method: "POST",
        body: fd,
      });
      const uploaded: Document[] = res.ok
        ? ((await res.json()) as Document[])
        : [];
      for (const f of queued) statuses[f.name] = res.ok ? "done" : "error";
      setUploadStatuses({ ...statuses });
      if (res.ok) {
        setDocs((prev) => [...prev, ...uploaded]);
        setTimeout(() => {
          setQueued([]);
          setUploadStatuses({});
        }, 1200);
      }
    } catch {
      for (const f of queued) statuses[f.name] = "error";
      setUploadStatuses({ ...statuses });
    }
  }

  function formatSize(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2.5"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {doc.name ?? doc.file?.name ?? "Document"}
                </p>
                {doc.file?.size && (
                  <p className="text-xs text-muted-foreground">
                    {formatSize(doc.file.size)}
                  </p>
                )}
              </div>
              {doc.file?.url && (
                <a
                  href={doc.file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-3">Upload documents</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(Array.from(e.dataTransfer.files));
          }}
          className="w-full rounded-lg border-2 border-dashed border-input px-4 py-5 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors text-center"
        >
          Drop files here or click to browse
        </button>

        {queued.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {queued.map((f) => {
              const status = uploadStatuses[f.name];
              return (
                <div
                  key={f.name}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatSize(f.size)}
                  </span>
                  {status === "uploading" && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  {status === "done" && (
                    <Check className="size-3.5 text-green-600" />
                  )}
                  {status === "error" && (
                    <AlertCircle className="size-3.5 text-destructive" />
                  )}
                  {!status && (
                    <button
                      type="button"
                      onClick={() =>
                        setQueued((prev) =>
                          prev.filter((d) => d.name !== f.name),
                        )
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            <Button
              size="sm"
              className="self-end mt-1"
              onClick={handleUpload}
              disabled={Object.values(uploadStatuses).some(
                (s) => s === "uploading",
              )}
            >
              <Upload className="size-3.5" />
              Upload {queued.length} file{queued.length > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compliance Tab ────────────────────────────────────────────────────────────

function ComplianceTab({
  lead,
  assetManagerId,
}: {
  lead: LeadRecord;
  assetManagerId: string;
}) {
  const [records, setRecords] = React.useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [starting, setStarting] = React.useState(false);
  const [selectedRecord, setSelectedRecord] =
    React.useState<ComplianceRecord | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/compliance-records?investor_lead=${lead.id}`)
      .then((r) => r.json())
      .then((d: unknown) =>
        setRecords(
          Array.isArray(d)
            ? d
            : ((d as { records?: ComplianceRecord[] }).records ?? []),
        ),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lead.id]);

  async function handleStartProcess() {
    setStarting(true);
    const res = await fetch("/api/compliance-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_manager: assetManagerId,
        investor_lead: lead.id,
        status: "pending",
      }),
    });
    setStarting(false);
    if (!res.ok) return;
    const newRecord = (await res.json()) as ComplianceRecord;
    setRecords((prev) => [newRecord, ...prev]);
    setSelectedRecord(newRecord);
    setSheetOpen(true);
  }

  const completedCount = records.filter((r) => r.status === "completed").length;
  const totalCount = records.length;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Compliance processes for this lead.
          </p>
          {totalCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <span
                className={cn(
                  "font-medium",
                  completedCount === totalCount
                    ? "text-green-600"
                    : "text-amber-600",
                )}
              >
                {completedCount}/{totalCount}
              </span>{" "}
              completed
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleStartProcess}
          disabled={starting}
        >
          {starting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Start process
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <ShieldCheck className="size-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No compliance records yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((record) => {
            const status = record.status ?? "pending";
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => {
                  setSelectedRecord(record);
                  setSheetOpen(true);
                }}
                className="flex items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40 w-full"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {record.cycle
                      ? `Cycle ${record.cycle}`
                      : "Onboarding process"}
                  </p>
                  {record.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {record.notes}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                    COMPLIANCE_STATUS_COLORS[status] ??
                      COMPLIANCE_STATUS_COLORS.pending,
                  )}
                >
                  {STATUS_LABELS[status]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ComplianceSheet
        record={selectedRecord}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={(updated) =>
          setRecords((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r)),
          )
        }
        onDeleted={(id) => {
          setRecords((prev) => prev.filter((r) => r.id !== id));
          setSheetOpen(false);
        }}
      />
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm font-medium">Tasks coming soon</p>
      <p className="text-xs text-muted-foreground">
        Task management for leads will be available in a future update.
      </p>
    </div>
  );
}

// ── Lead Sheet ────────────────────────────────────────────────────────────────

export function LeadSheet({
  lead,
  funds,
  entityId,
  assetManagerId,
  open,
  onOpenChange,
  onUpdated,
}: {
  lead: LeadRecord | null;
  funds: Fund[];
  entityId: string;
  assetManagerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: (updated: LeadRecord) => void;
}) {
  const [fullLead, setFullLead] = React.useState<LeadRecord | null>(null);

  React.useEffect(() => {
    if (!open || !lead) return;
    setFullLead(lead);
    fetch(`/api/investor-leads/${lead.id}`)
      .then((r) => r.json())
      .then((d) => setFullLead(d as LeadRecord))
      .catch(() => {});
  }, [open, lead?.id]);

  const status = fullLead?.status ?? lead?.status ?? "lead";
  const interestCount =
    fullLead?.interests?.length ?? lead?.interests?.length ?? 0;

  const totalCommitted = React.useMemo(() => {
    const interests = fullLead?.interests ?? lead?.interests ?? [];
    return interests.reduce((sum, i) => sum + (i.committed_amount ?? 0), 0);
  }, [fullLead?.interests, lead?.interests]);

  function formatCompact(n: number) {
    if (n === 0) return "—";
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
    return `€${n.toLocaleString()}`;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto w-[90vw]! p-0">
        <div className="flex flex-col">
          {/* Header */}
          <SheetHeader className="shrink-0 px-4 pt-4">
            <SheetTitle>{fullLead?.name ?? lead?.name ?? "Lead"}</SheetTitle>
            <SheetDescription>
              {[fullLead?.company, fullLead?.email].filter(Boolean).join(" · ")}
            </SheetDescription>
          </SheetHeader>

          {/* Summary cards */}
          <div className="flex-1 space-y-3 px-4 pb-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Status</p>
                <p
                  className={cn(
                    "mt-1 text-sm font-medium capitalize",
                    STATUS_COLORS[status] ?? STATUS_COLORS.lead,
                  )}
                >
                  {status}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Funds</p>
                <p className="mt-1 text-sm font-medium">
                  {interestCount > 0
                    ? `${interestCount} fund${interestCount > 1 ? "s" : ""}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Committed</p>
                <p className="mt-1 text-sm font-medium">
                  {formatCompact(totalCommitted)}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          {fullLead ? (
            <div className="px-4 pb-4">
              <Tabs defaultValue="overview" className="h-full">
                <TabsList className="w-full justify-start gap-1 overflow-x-auto whitespace-nowrap">
                  <TabsTrigger className="px-3" value="overview">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger className="px-3" value="interests">
                    Interests
                    {interestCount > 0 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                        {interestCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger className="px-3" value="documents">
                    Documents
                  </TabsTrigger>
                  <TabsTrigger className="px-3" value="compliance">
                    Compliance
                  </TabsTrigger>
                  <TabsTrigger className="px-3" value="tasks">
                    Tasks
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                  <OverviewTab
                    lead={fullLead}
                    onUpdated={(updated) => {
                      setFullLead(updated);
                      onUpdated?.(updated);
                    }}
                  />
                </TabsContent>
                <TabsContent value="interests" className="mt-4">
                  <InterestsTab
                    lead={fullLead}
                    funds={funds}
                    onUpdated={(updated) => {
                      setFullLead(updated);
                      onUpdated?.(updated);
                    }}
                  />
                </TabsContent>
                <TabsContent value="documents" className="mt-4">
                  <DocumentsTab lead={fullLead} entityId={entityId} />
                </TabsContent>
                <TabsContent value="compliance" className="mt-4">
                  <ComplianceTab
                    lead={fullLead}
                    assetManagerId={assetManagerId}
                  />
                </TabsContent>
                <TabsContent value="tasks" className="mt-4">
                  <TasksTab />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
