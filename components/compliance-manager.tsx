"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import {
  type ComplianceRecord,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/components/add-compliance-dialog";
import { ComplianceSheet } from "@/components/compliance-sheet";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { label: "All", value: null },
  { label: "Pending", value: "pending" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
] as const;

export function ComplianceManager({
  initialRecords,
}: {
  assetManagerId: string;
  initialRecords: ComplianceRecord[];
}) {
  const [records, setRecords] =
    React.useState<ComplianceRecord[]>(initialRecords);
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] =
    React.useState<ComplianceRecord | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const filtered =
    statusFilter == null
      ? records
      : records.filter((r) => r.status === statusFilter);

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Compliance
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {records.length} record{records.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm transition-colors",
                statusFilter === f.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {f.label}
              {f.value === null && records.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  {records.length}
                </span>
              )}
              {f.value !== null && (
                <span className="ml-1.5 text-xs opacity-60">
                  {records.filter((r) => r.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Records list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">No compliance records</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {statusFilter
                  ? `No ${STATUS_LABELS[statusFilter]?.toLowerCase()} records.`
                  : "Compliance records are created from the investor lead sheet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((record) => {
              const status = record.status ?? "pending";
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => {
                    setSelectedRecord(record);
                    setSheetOpen(true);
                  }}
                  className="flex items-center gap-4 rounded-lg border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 w-full"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {record._investor_lead?.name ?? "Unknown lead"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {record.cycle ? `Cycle ${record.cycle}` : "Onboarding process"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                      STATUS_COLORS[status] ?? STATUS_COLORS.pending,
                    )}
                  >
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ComplianceSheet
        record={selectedRecord}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={(updated) => {
          setRecords((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r)),
          );
          setSelectedRecord(updated);
        }}
        onDeleted={(id) => {
          setRecords((prev) => prev.filter((r) => r.id !== id));
          setSheetOpen(false);
        }}
      />
    </>
  );
}
