"use client";

import * as React from "react";
import { Loader2, Trash2, Check, Plus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DateTimePickerInput } from "@/components/date-time-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ComplianceRecord,
  type ComplianceLeg,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/components/add-compliance-dialog";
import { cn } from "@/lib/utils";

const LEG_TYPES = [
  "kyc",
  "aml",
  "onboarding",
  "document_request",
  "periodic_review",
] as const;

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

export function ComplianceSheet({
  record,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  record: ComplianceRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: (updated: ComplianceRecord) => void;
  onDeleted?: (id: string) => void;
}) {
  const [current, setCurrent] = React.useState<ComplianceRecord | null>(null);
  const [legs, setLegs] = React.useState<ComplianceLeg[]>([]);
  const [legsLoading, setLegsLoading] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Add check form
  const [addTitle, setAddTitle] = React.useState("");
  const [addType, setAddType] = React.useState<string>("kyc");
  const [addDueDate, setAddDueDate] = React.useState<Date | undefined>(undefined);
  const [addSaving, setAddSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && record) {
      setCurrent(record);
      setNotes(record.notes ?? "");
      setError(null);
    }
  }, [open, record?.id]);

  React.useEffect(() => {
    if (!current?.id) return;
    setLegsLoading(true);
    fetch(`/api/compliance-legs?compliance_record=${current.id}`)
      .then((r) => r.json())
      .then((d: unknown) => {
        setLegs(
          Array.isArray(d)
            ? d
            : ((d as { legs?: ComplianceLeg[] }).legs ?? []),
        );
      })
      .catch(() => {})
      .finally(() => setLegsLoading(false));
  }, [current?.id]);

  async function toggleLeg(leg: ComplianceLeg) {
    const newStatus = leg.status === "completed" ? "pending" : "completed";
    const body: Record<string, unknown> = { status: newStatus };
    if (newStatus === "completed") body.completed_at = Date.now();
    else body.completed_at = null;

    const res = await fetch(`/api/compliance-legs/${leg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as ComplianceLeg;
    const newLegs = legs.map((l) => (l.id === leg.id ? updated : l));
    setLegs(newLegs);

    // Auto-complete record if all legs done
    if (
      newStatus === "completed" &&
      current &&
      current.status !== "completed"
    ) {
      const allDone = newLegs.every((l) => l.status === "completed");
      if (allDone && newLegs.length > 0) {
        const recRes = await fetch(`/api/compliance-records/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        if (recRes.ok) {
          const updatedRec = (await recRes.json()) as ComplianceRecord;
          const next = { ...current, ...updatedRec };
          setCurrent(next);
          onUpdated?.(next);
        }
      }
    }
  }

  async function deleteLeg(leg: ComplianceLeg) {
    if (!window.confirm("Delete this check?")) return;
    const res = await fetch(`/api/compliance-legs/${leg.id}`, {
      method: "DELETE",
    });
    if (res.ok) setLegs((prev) => prev.filter((l) => l.id !== leg.id));
  }

  async function handleAddLeg(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || !current) return;
    setAddSaving(true);
    const body: Record<string, unknown> = {
      compliance_record: current.id,
      title: addTitle.trim(),
      type: addType,
      status: "pending",
    };
    if (addDueDate) body.due_date = addDueDate.getTime();
    const res = await fetch("/api/compliance-legs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAddSaving(false);
    if (!res.ok) return;
    const newLeg = (await res.json()) as ComplianceLeg;
    setLegs((prev) => [...prev, newLeg]);
    setAddTitle("");
    setAddDueDate(undefined);
  }

  async function handleSaveNotes() {
    if (!current) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/compliance-records/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Failed to save.");
      return;
    }
    const updatedRec = (await res.json()) as ComplianceRecord;
    const next = { ...current, ...updatedRec };
    setCurrent(next);
    onUpdated?.(next);
  }

  async function handleDelete() {
    if (!current) return;
    if (
      !window.confirm(
        "Delete this compliance record? This cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    const res = await fetch(`/api/compliance-records/${current.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      onDeleted?.(current.id);
      onOpenChange(false);
    }
  }

  if (!current && !record) return null;
  const rec = current ?? record!;
  const status = rec.status ?? "pending";
  const completedLegs = legs.filter((l) => l.status === "completed").length;
  const totalLegs = legs.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto w-[90vw]! p-0">
        <div className="flex flex-col gap-6 p-4 pb-8">
          <SheetHeader>
            <SheetTitle>
              {rec._investor_lead?.name
                ? `${rec._investor_lead.name} — Compliance`
                : "Compliance"}
            </SheetTitle>
            <SheetDescription>
              {rec.cycle ? `Cycle ${rec.cycle}` : "Onboarding process"}
            </SheetDescription>
          </SheetHeader>

          {/* Status + progress */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                STATUS_COLORS[status] ?? STATUS_COLORS.pending,
              )}
            >
              {STATUS_LABELS[status] ?? status}
            </span>
            {totalLegs > 0 && (
              <>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{
                      width: `${(completedLegs / totalLegs) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {completedLegs}/{totalLegs}
                </span>
              </>
            )}
          </div>

          {/* Checks */}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Checks
            </p>
            {legsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : legs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No checks yet. Add one below.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {legs.map((leg) => {
                  const isOverdue =
                    leg.due_date != null &&
                    leg.status !== "completed" &&
                    leg.due_date < Date.now();
                  return (
                    <div
                      key={leg.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 group"
                    >
                      <button
                        type="button"
                        onClick={() => toggleLeg(leg)}
                        className={cn(
                          "shrink-0 size-5 rounded border-2 flex items-center justify-center transition-colors",
                          leg.status === "completed"
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-muted-foreground/40 hover:border-green-400",
                        )}
                      >
                        {leg.status === "completed" && (
                          <Check className="size-3" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span
                          className={cn(
                            "text-sm",
                            leg.status === "completed" &&
                              "line-through text-muted-foreground",
                          )}
                        >
                          {leg.title ?? "Untitled"}
                        </span>
                        {leg.type && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {TYPE_LABELS[leg.type]}
                          </span>
                        )}
                        {leg.due_date && (
                          <span
                            className={cn(
                              "ml-2 text-xs",
                              isOverdue
                                ? "text-red-500"
                                : "text-muted-foreground",
                            )}
                          >
                            Due {formatDate(leg.due_date)}
                            {isOverdue && " (overdue)"}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteLeg(leg)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add check inline form */}
            <form
              onSubmit={handleAddLeg}
              className="flex items-center gap-2 mt-3 flex-wrap"
            >
              <Input
                placeholder="Add a check…"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="flex-1 h-8 text-sm min-w-32"
              />
              <Select value={addType} onValueChange={setAddType}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateTimePickerInput
                id="leg-due"
                label=""
                value={addDueDate}
                onChange={(d) => setAddDueDate(d)}
                showTime={false}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={addSaving || !addTitle.trim()}
              >
                {addSaving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </Button>
            </form>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
            <Button onClick={handleSaveNotes} disabled={saving} size="sm">
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save notes"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
