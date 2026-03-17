"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  LayoutList,
  Kanban,
  AlertTriangle,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Settings2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AddInvestorDialog } from "@/components/add-investor-dialog";
import { LeadSheet, type LeadRecord } from "@/components/lead-sheet";
import { ConvertToInvestorDialog } from "@/components/convert-to-investor-dialog";
import { cn } from "@/lib/utils";
import {
  fetchCapTableShareholders,
  fetchShareClasses,
  type CapTableShareholder,
  type CapitalCall,
  type ShareClass,
} from "@/lib/cap-table";
import { InvestorSheet } from "@/components/investor-sheet";
import { FundInvestmentSheet } from "@/components/fund-investment-sheet";
import { IssueCapitalCallDialog } from "@/components/issue-capital-call-dialog";

type Fund = { id: string; name?: string | null; entity?: string | null };

type Lead = LeadRecord & {
  source?: string | null;
};

const STATUSES = [
  "lead",
  "prospect",
  "qualified",
  "onboarding",
  "investor",
] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  lead: "Lead",
  prospect: "Prospect",
  qualified: "Qualified",
  onboarding: "Onboarding",
  investor: "Investor",
};

const STATUS_STYLES: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  qualified:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  onboarding:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  investor:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const COLUMN_HEADER_STYLES: Record<Status, string> = {
  lead: "border-slate-200 dark:border-slate-700",
  prospect: "border-blue-200 dark:border-blue-800",
  qualified: "border-amber-200 dark:border-amber-800",
  onboarding: "border-purple-200 dark:border-purple-800",
  investor: "border-green-200 dark:border-green-800",
};

function StatusBadge({ status }: { status?: string | null }) {
  const s = status ?? "lead";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        STATUS_STYLES[s] ?? STATUS_STYLES.lead,
      )}
    >
      {STATUS_LABELS[s as Status] ?? s}
    </span>
  );
}

// ── List view card ────────────────────────────────────────────────────────────

function ListCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 gap-4 text-left hover:bg-muted/40 transition-colors"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-medium text-sm truncate">{lead.name ?? "—"}</span>
        <div className="flex items-center gap-2 flex-wrap">
          {lead.email && (
            <span className="text-xs text-muted-foreground">{lead.email}</span>
          )}
          {lead.phone && (
            <span className="text-xs text-muted-foreground">{lead.phone}</span>
          )}
          {lead.source && (
            <span className="text-xs text-muted-foreground">
              via {lead.source}
            </span>
          )}
          {lead.created_at && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(lead.created_at), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <StatusBadge status={lead.status} />
      </div>
    </button>
  );
}

// ── Kanban draggable card ─────────────────────────────────────────────────────

function KanbanCard({
  lead,
  onClick,
  overlay = false,
}: {
  lead: Lead;
  onClick: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: lead.id,
      data: { lead },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "rounded-md border bg-background p-3 text-sm select-none cursor-pointer",
        isDragging && !overlay ? "opacity-40" : "shadow-sm",
        overlay
          ? "shadow-lg rotate-1 cursor-grabbing"
          : "hover:shadow-md transition-shadow",
      )}
    >
      <p className="font-medium truncate">{lead.name ?? "—"}</p>
      {lead.company && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {lead.company}
        </p>
      )}
      {lead.email && (
        <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
      )}
      {lead.created_at && (
        <p className="text-xs text-muted-foreground mt-1.5">
          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

// ── Kanban droppable column ───────────────────────────────────────────────────

function KanbanColumn({
  status,
  leads,
  onCardClick,
}: {
  status: Status;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Column header */}
      <div
        className={cn(
          "flex items-center justify-between pb-2 border-b-2",
          COLUMN_HEADER_STYLES[status],
        )}
      >
        <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {leads.length}
        </span>
      </div>
      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-24 rounded-md p-1 transition-colors",
          isOver && "bg-muted/50",
        )}
      >
        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onClick={() => onCardClick(lead)}
          />
        ))}
        {leads.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-16 rounded-md border border-dashed">
            <p className="text-xs text-muted-foreground">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Investors table (committed investors from cap table) ──────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n);
}

const CALL_STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InvestorsTable({
  entityId,
  entityUUID,
  assetManagerId,
  funds,
}: {
  entityId: string;
  entityUUID: string;
  assetManagerId: string;
  funds: { id: string; name?: string | null; entity?: string | null }[];
}) {
  const [shareholders, setShareholders] = React.useState<CapTableShareholder[]>(
    [],
  );
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(
    new Set(),
  );
  const [expandedFunds, setExpandedFunds] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectedShareholder, setSelectedShareholder] =
    React.useState<CapTableShareholder | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [issueCallTarget, setIssueCallTarget] = React.useState<{
    shareholderId: string;
    fundShareholderId: string;
    fundEntityId: string;
    fundEntryId: string;
    fundName: string;
    committedAmount: number | null;
    alreadyCalled: number;
    shareClassId?: string | null;
  } | null>(null);
  const [fundSheetTarget, setFundSheetTarget] = React.useState<{
    sh: CapTableShareholder;
    chId: string;
  } | null>(null);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sh, sc] = await Promise.all([
          fetchCapTableShareholders(entityId),
          fetchShareClasses(entityId),
        ]);
        setShareholders(sh.filter((s) => s.role === "investor"));
        setShareClasses(sc);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [entityId]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFund(id: string) {
    setExpandedFunds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
        <Loader2 className="size-4 animate-spin" /> Loading investors…
      </div>
    );
  }

  if (shareholders.length === 0) {
    return (
      <div className="border rounded-lg py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No committed investors yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Convert a lead to investor using the Pipeline tab.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
            <th className="w-8 px-2 py-2.5" />
            <th className="text-left px-4 py-2.5 font-medium">Investor</th>
            <th className="text-right px-4 py-2.5 font-medium">Committed</th>
            <th className="text-right px-4 py-2.5 font-medium">Called</th>
            <th className="text-right px-4 py-2.5 font-medium">Uncalled</th>
            <th className="text-right px-4 py-2.5 font-medium">Paid in</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground/50">
              Paid out
            </th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground/50">
              Live value
            </th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground/50">
              G/L
            </th>
            <th className="text-left px-4 py-2.5 font-medium">Funds</th>
            <th className="text-left px-4 py-2.5 font-medium">Call status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {shareholders.map((sh) => {
            const amEntry = sh._cap_table_entry?.[0] ?? null;
            const fundChildren = sh._parent_shareholder ?? [];
            const allCalls = fundChildren.flatMap((ch) =>
              (ch._cap_table_entry ?? []).flatMap((e) => e._capital_call ?? []),
            );
            const committed = amEntry?.committed_amount ?? 0;
            const called = allCalls.reduce((s, c) => s + (c.amount ?? 0), 0);
            const uncalled = Math.max(0, committed - called);
            const paidIn = allCalls
              .filter((c) => c.status === "paid")
              .reduce((s, c) => s + (c.amount ?? 0), 0);
            const fundNames = Array.from(
              new Set(
                fundChildren
                  .map((ch) => {
                    const fund = funds.find((f) => f.entity === ch.entity);
                    return fund?.name ?? ch._entity?._fund?.name ?? null;
                  })
                  .filter(Boolean),
              ),
            );
            const allPaid =
              allCalls.length > 0 && allCalls.every((c) => c.status === "paid");
            const anyPartial = allCalls.some((c) => c.status === "partial");
            const anyPending = allCalls.some((c) => c.status === "pending");
            const callStatus = allPaid
              ? "paid"
              : anyPartial
                ? "partial"
                : anyPending
                  ? "pending"
                  : null;
            const expanded = expandedRows.has(sh.id);

            return (
              <React.Fragment key={sh.id}>
                <tr className="hover:bg-muted/20 transition-colors cursor-pointer">
                  <td
                    className="px-2 py-3 text-muted-foreground"
                    onClick={() => toggleRow(sh.id)}
                  >
                    {expanded ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{sh.name ?? "—"}</p>
                    {sh.email && (
                      <p className="text-xs text-muted-foreground">
                        {sh.email}
                      </p>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums"
                    onClick={() => toggleRow(sh.id)}
                  >
                    {fmt(committed)}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums"
                    onClick={() => toggleRow(sh.id)}
                  >
                    {fmt(called)}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums text-muted-foreground"
                    onClick={() => toggleRow(sh.id)}
                  >
                    {uncalled > 0 ? fmt(uncalled) : "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums text-green-600"
                    onClick={() => toggleRow(sh.id)}
                  >
                    {fmt(paidIn)}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums text-muted-foreground/40 text-xs"
                    onClick={() => toggleRow(sh.id)}
                  >
                    —
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums text-muted-foreground/40 text-xs"
                    onClick={() => toggleRow(sh.id)}
                  >
                    —
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums text-muted-foreground/40 text-xs"
                    onClick={() => toggleRow(sh.id)}
                  >
                    —
                  </td>
                  <td
                    className="px-4 py-3 text-muted-foreground"
                    onClick={() => toggleRow(sh.id)}
                  >
                    {fundNames.length > 0 ? fundNames.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3" onClick={() => toggleRow(sh.id)}>
                    {callStatus ? (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          CALL_STATUS_STYLES[callStatus],
                        )}
                      >
                        {callStatus.charAt(0).toUpperCase() +
                          callStatus.slice(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => {
                        setSelectedShareholder(sh);
                        setSheetOpen(true);
                      }}
                    >
                      <Settings2 className="size-3" />
                      Manage
                    </Button>
                  </td>
                </tr>
                {/* Fund-level expansion rows */}
                {expanded &&
                  fundChildren.length > 0 &&
                  fundChildren.map((ch) => {
                    const matchedFund = funds.find(
                      (f) => f.entity === ch.entity,
                    );
                    const feName =
                      matchedFund?.name ?? ch._entity?._fund?.name ?? "Fund";
                    const fundHref = matchedFund
                      ? `/asset-manager/${assetManagerId}/fund/${matchedFund.id}`
                      : null;
                    const feEntry = ch._cap_table_entry?.[0] ?? null;
                    const feCalls = feEntry?._capital_call ?? [];
                    const feCalled = feCalls.reduce(
                      (s, c) => s + (c.amount ?? 0),
                      0,
                    );
                    const feUncalled = Math.max(
                      0,
                      (feEntry?.committed_amount ?? 0) - feCalled,
                    );
                    const fePaid = feCalls
                      .filter((c) => c.status === "paid")
                      .reduce((s, c) => s + (c.amount ?? 0), 0);
                    const feAllPaid =
                      feCalls.length > 0 &&
                      feCalls.every((c) => c.status === "paid");
                    const feAnyPending = feCalls.some(
                      (c) => c.status === "pending",
                    );
                    const feCallStatus = feAllPaid
                      ? "paid"
                      : feAnyPending
                        ? "pending"
                        : feCalls.length > 0
                          ? "partial"
                          : null;
                    const feShareClassId = feCalls[0]?.share_class ?? null;
                    const sc = shareClasses.find(
                      (s) => s.id === feShareClassId,
                    );
                    const fundExpanded = expandedFunds.has(ch.id);
                    return (
                      <React.Fragment key={ch.id}>
                        <tr
                          className="bg-muted/20 border-b text-xs cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() =>
                            feCalls.length > 0 && toggleFund(ch.id)
                          }
                        >
                          <td className="px-2 py-2 text-muted-foreground">
                            {feCalls.length > 0 &&
                              (fundExpanded ? (
                                <ChevronDown className="size-3" />
                              ) : (
                                <ChevronRight className="size-3" />
                              ))}
                          </td>
                          <td className="px-4 py-2 pl-8">
                            {fundHref ? (
                              <Link
                                href={fundHref}
                                className="font-medium hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {feName}
                              </Link>
                            ) : (
                              <span className="font-medium">{feName}</span>
                            )}
                            {sc && (
                              <p className="text-muted-foreground opacity-70">
                                {sc.name}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {fmt(feEntry?.committed_amount)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {fmt(feCalled)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                            {feUncalled > 0 ? fmt(feUncalled) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-green-600">
                            {fmt(fePaid)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground/40 text-xs">—</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground/40 text-xs">—</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground/40 text-xs">—</td>
                          <td />
                          <td className="px-4 py-2">
                            {feCallStatus && (
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded font-medium",
                                  CALL_STATUS_STYLES[feCallStatus],
                                )}
                              >
                                {feCallStatus.charAt(0).toUpperCase() +
                                  feCallStatus.slice(1)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFundSheetTarget({ sh, chId: ch.id });
                              }}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                        {fundExpanded &&
                          feCalls.map((cc) => {
                            const isLocked = cc.status !== "pending";
                            return (
                              <tr
                                key={cc.id}
                                className="bg-muted/30 border-b text-xs"
                              >
                                <td colSpan={3} className="px-4 py-2 pl-20">
                                  <p className="font-medium text-foreground">
                                    Capital call
                                  </p>
                                  {cc.called_at && (
                                    <p className="text-muted-foreground">
                                      {fmtDate(cc.called_at)}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  {fmt(cc.amount)}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                                  —
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-green-600">
                                  {cc.status === "paid" ? fmt(cc.amount) : "—"}
                                </td>
                                <td />
                                <td />
                                <td />
                                <td />
                                <td className="px-4 py-2">
                                  {cc.status && (
                                    <span
                                      className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded font-medium",
                                        CALL_STATUS_STYLES[cc.status],
                                      )}
                                    >
                                      {cc.status.charAt(0).toUpperCase() +
                                        cc.status.slice(1)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground"
                                      >
                                        <MoreHorizontal className="size-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      {feEntry && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            setIssueCallTarget({
                                              shareholderId: sh.id,
                                              fundShareholderId: ch.id,
                                              fundEntityId: ch.entity,
                                              fundEntryId: feEntry.id,
                                              fundName: feName,
                                              committedAmount: feEntry.committed_amount ?? null,
                                              alreadyCalled: feCalled,
                                              shareClassId: feShareClassId,
                                            })
                                          }
                                        >
                                          Issue new call
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      {isLocked ? (
                                        <DropdownMenuItem disabled className="text-muted-foreground">
                                          <Pencil className="size-3 mr-2" />
                                          Locked — payment received
                                        </DropdownMenuItem>
                                      ) : (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              setFundSheetTarget({ sh, chId: ch.id })
                                            }
                                          >
                                            <Pencil className="size-3 mr-2" />
                                            Edit call
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={async () => {
                                              if (!window.confirm("Delete this capital call?")) return;
                                              const res = await fetch(`/api/capital-calls/${cc.id}`, { method: "DELETE" });
                                              if (res.ok) {
                                                setShareholders((prev) =>
                                                  prev.map((s) => {
                                                    if (s.id !== sh.id) return s;
                                                    return {
                                                      ...s,
                                                      _parent_shareholder: (s._parent_shareholder ?? []).map((c) => {
                                                        if (c.id !== ch.id) return c;
                                                        return {
                                                          ...c,
                                                          _cap_table_entry: (c._cap_table_entry ?? []).map((e) =>
                                                            e.id === feEntry?.id
                                                              ? { ...e, _capital_call: (e._capital_call ?? []).filter((call) => call.id !== cc.id) }
                                                              : e,
                                                          ),
                                                        };
                                                      }),
                                                    };
                                                  }),
                                                );
                                              }
                                            }}
                                          >
                                            <Trash2 className="size-3 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                {expanded && fundChildren.length === 0 && (
                  <tr className="bg-muted/20 border-b">
                    <td />
                    <td
                      colSpan={11}
                      className="px-4 py-2 pl-8 text-xs text-muted-foreground"
                    >
                      No fund commitments found.
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 font-medium text-xs">
            <td />
            <td className="px-4 py-2.5">
              {shareholders.length} investor
              {shareholders.length !== 1 ? "s" : ""}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {fmt(
                shareholders.reduce(
                  (s, sh) =>
                    s + (sh._cap_table_entry?.[0]?.committed_amount ?? 0),
                  0,
                ),
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {fmt(
                shareholders
                  .flatMap((sh) =>
                    (sh._parent_shareholder ?? []).flatMap((ch) =>
                      (ch._cap_table_entry ?? []).flatMap(
                        (e) => e._capital_call ?? [],
                      ),
                    ),
                  )
                  .reduce((s, c) => s + (c.amount ?? 0), 0),
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground/40">
              —
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-green-600">
              {fmt(
                shareholders
                  .flatMap((sh) =>
                    (sh._parent_shareholder ?? []).flatMap((ch) =>
                      (ch._cap_table_entry ?? []).flatMap(
                        (e) => e._capital_call ?? [],
                      ),
                    ),
                  )
                  .filter((c) => c.status === "paid")
                  .reduce((s, c) => s + (c.amount ?? 0), 0),
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground/40">
              —
            </td>
            <td colSpan={5} />
          </tr>
        </tfoot>
      </table>

      <InvestorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        shareholder={selectedShareholder}
        entityUUID={entityUUID}
        funds={funds}
        onUpdated={() => {
          void (async () => {
            const sh = await fetchCapTableShareholders(entityId);
            setShareholders(sh.filter((s) => s.role === "investor"));
          })();
        }}
      />

      {fundSheetTarget && (() => {
        const targetSh = shareholders.find((s) => s.id === fundSheetTarget.sh.id) ?? fundSheetTarget.sh;
        const targetCh = (targetSh._parent_shareholder ?? []).find((c) => c.id === fundSheetTarget.chId) ?? null;
        const matchedFund = targetCh ? funds.find((f) => f.entity === targetCh.entity) ?? null : null;
        return (
          <FundInvestmentSheet
            open={!!fundSheetTarget}
            onOpenChange={(v) => { if (!v) setFundSheetTarget(null); }}
            ch={targetCh}
            fund={matchedFund}
            shareholderName={targetSh.name ?? "Investor"}
            shareClasses={shareClasses}
            assetManagerId={assetManagerId}
            onIssueCall={() => {
              if (!targetCh || !targetCh._cap_table_entry?.[0]) return;
              const entry = targetCh._cap_table_entry[0];
              const calls = entry._capital_call ?? [];
              const called = calls.reduce((s, c) => s + (c.amount ?? 0), 0);
              const fundName = matchedFund?.name ?? targetCh._entity?._fund?.name ?? "Fund";
              setIssueCallTarget({
                shareholderId: targetSh.id,
                fundShareholderId: targetCh.id,
                fundEntityId: targetCh.entity,
                fundEntryId: entry.id,
                fundName,
                committedAmount: entry.committed_amount ?? null,
                alreadyCalled: called,
                shareClassId: calls[0]?.share_class ?? null,
              });
            }}
            onUpdated={async () => {
              const sh = await fetchCapTableShareholders(entityId);
              setShareholders(sh.filter((s) => s.role === "investor"));
            }}
          />
        );
      })()}

      {issueCallTarget && (
        <IssueCapitalCallDialog
          open={!!issueCallTarget}
          onOpenChange={(v) => {
            if (!v) setIssueCallTarget(null);
          }}
          fundEntityId={issueCallTarget.fundEntityId}
          fundEntryId={issueCallTarget.fundEntryId}
          fundName={issueCallTarget.fundName}
          committedAmount={issueCallTarget.committedAmount}
          alreadyCalled={issueCallTarget.alreadyCalled}
          shareClassId={issueCallTarget.shareClassId}
          onIssued={(call) => {
            setShareholders((prev) =>
              prev.map((sh) => {
                if (sh.id !== issueCallTarget.shareholderId) return sh;
                return {
                  ...sh,
                  _parent_shareholder: (sh._parent_shareholder ?? []).map(
                    (ch) => {
                      if (ch.id !== issueCallTarget.fundShareholderId)
                        return ch;
                      return {
                        ...ch,
                        _cap_table_entry: (ch._cap_table_entry ?? []).map(
                          (e) =>
                            e.id === issueCallTarget.fundEntryId
                              ? {
                                  ...e,
                                  _capital_call: [
                                    ...(e._capital_call ?? []),
                                    call,
                                  ],
                                }
                              : e,
                        ),
                      };
                    },
                  ),
                };
              }),
            );
            setIssueCallTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvestorsManager({
  assetManagerId,
  entityId,
  funds,
  initialLeads,
  defaultPhoneCountry,
}: {
  assetManagerId: string;
  entityId: string;
  funds: Fund[];
  initialLeads: Lead[];
  defaultPhoneCountry?: string;
}) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [view, setView] = React.useState<"list" | "kanban">("kanban");
  const [tab, setTab] = React.useState<"pipeline" | "investors">("pipeline");
  const [draggingLead, setDraggingLead] = React.useState<Lead | null>(null);
  const [gateError, setGateError] = React.useState<{
    leadName: string;
    missing: string[];
  } | null>(null);
  const [gateChecking, setGateChecking] = React.useState(false);
  const [convertLead, setConvertLead] = React.useState<Lead | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function openLead(lead: Lead) {
    setSelectedLead(lead);
    setSheetOpen(true);
  }

  function handleLeadUpdated(updated: LeadRecord) {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
    );
    setSelectedLead((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id);
    setDraggingLead(lead ?? null);
    setGateError(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingLead(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as Status;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    // Qualification gate
    if (newStatus === "qualified") {
      const missing: string[] = [];
      const hasFund = (lead.interests ?? []).some((i) => !!i.fund);
      const hasAmount = (lead.interests ?? []).some(
        (i) => i.committed_amount != null && i.committed_amount > 0,
      );
      if (!hasFund) missing.push("At least one fund interest must be selected");
      if (!hasAmount) missing.push("At least one committed amount must be set");
      if (!lead.investor_classification)
        missing.push("Investor classification must be set");
      if (missing.length > 0) {
        setGateError({ leadName: lead.name ?? "Lead", missing });
        return;
      }
    }

    // Compliance gate + conversion dialog
    if (newStatus === "investor") {
      setGateChecking(true);
      let complianceRecords: { status?: string | null }[] = [];
      try {
        const res = await fetch(
          `/api/compliance-records?investor_lead=${leadId}`,
        );
        if (res.ok) {
          const data = await res.json();
          complianceRecords = Array.isArray(data) ? data : (data.records ?? []);
        }
      } catch {
        /* ignore */
      }
      setGateChecking(false);

      const missing: string[] = [];
      if (complianceRecords.length === 0) {
        missing.push("At least one compliance record is required");
      } else {
        const incomplete = complianceRecords.filter(
          (r) => r.status !== "completed",
        ).length;
        if (incomplete > 0)
          missing.push(
            `${incomplete} compliance record${incomplete > 1 ? "s" : ""} not yet completed`,
          );
      }
      if (missing.length > 0) {
        setGateError({ leadName: lead.name ?? "Lead", missing });
        return;
      }

      // Gate passed — open conversion dialog instead of auto-patching
      setConvertLead(lead);
      setConvertDialogOpen(true);
      return;
    }

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)),
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    // Persist
    const res = await fetch(`/api/investor-leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l)),
      );
      return;
    }

    // Auto-create compliance record + KYC/AML legs when moving to onboarding
    if (newStatus === "onboarding") {
      const dueDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      try {
        const recRes = await fetch("/api/compliance-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_manager: assetManagerId,
            investor_lead: leadId,
            status: "pending",
          }),
        });
        if (recRes.ok) {
          const rec = (await recRes.json()) as { id: string };
          await Promise.allSettled([
            fetch("/api/compliance-legs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                compliance_record: rec.id,
                title: "KYC Verification",
                type: "kyc",
                status: "pending",
                due_date: dueDate,
              }),
            }),
            fetch("/api/compliance-legs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                compliance_record: rec.id,
                title: "AML Check",
                type: "aml",
                status: "pending",
                due_date: dueDate,
              }),
            }),
          ]);
        }
      } catch {
        /* ignore */
      }
    }
  }

  const leadsByStatus = React.useMemo(() => {
    const map: Record<Status, Lead[]> = {
      lead: [],
      prospect: [],
      qualified: [],
      onboarding: [],
      investor: [],
    };
    for (const l of leads) {
      const s = (l.status ?? "lead") as Status;
      if (s in map) map[s].push(l);
      else map.lead.push(l);
    }
    return map;
  }, [leads]);

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Investors</h2>
          </div>
          <div className="flex items-center gap-2">
            {tab === "pipeline" && (
              <>
                {/* View toggle */}
                <div className="flex items-center rounded-md border bg-background overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={cn(
                      "p-1.5 transition-colors",
                      view === "list"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="List view"
                  >
                    <LayoutList className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("kanban")}
                    className={cn(
                      "p-1.5 transition-colors",
                      view === "kanban"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Kanban view"
                  >
                    <Kanban className="size-4" />
                  </button>
                </div>
                <AddInvestorDialog
                  assetManagerId={assetManagerId}
                  entityId={entityId}
                  funds={funds}
                  defaultPhoneCountry={defaultPhoneCountry}
                  onCreated={(lead) =>
                    setLeads((prev) => [lead as Lead, ...prev])
                  }
                />
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b -mt-2">
          <button
            type="button"
            onClick={() => setTab("pipeline")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "pipeline"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setTab("investors")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "investors"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Committed investors
          </button>
        </div>

        {tab === "investors" && (
          <InvestorsTable
            entityId={entityId}
            entityUUID={entityId}
            assetManagerId={assetManagerId}
            funds={funds}
          />
        )}

        {tab === "pipeline" && (
          <>
            {/* Gate checking indicator */}
            {gateChecking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Checking compliance
                records…
              </div>
            )}

            {/* Gate error banner */}
            {gateError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30 flex items-start gap-3">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Cannot move{" "}
                    <span className="font-semibold">{gateError.leadName}</span>
                  </p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5">
                    {gateError.missing.map((item) => (
                      <li
                        key={item}
                        className="text-xs text-amber-600 dark:text-amber-500"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    Open the lead sheet → Compliance tab to resolve.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGateError(null)}
                  className="shrink-0 text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* List view */}
            {view === "list" &&
              (leads.length === 0 ? (
                <div className="border rounded-lg py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    No investors yet. Add one to get started.
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {leads.map((lead) => (
                    <ListCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => openLead(lead)}
                    />
                  ))}
                </div>
              ))}

            {/* Kanban view */}
            {view === "kanban" && (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-5 gap-4">
                  {STATUSES.map((status) => (
                    <KanbanColumn
                      key={status}
                      status={status}
                      leads={leadsByStatus[status]}
                      onCardClick={openLead}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={null}>
                  {draggingLead ? (
                    <KanbanCard
                      lead={draggingLead}
                      onClick={() => {}}
                      overlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}
      </div>

      <LeadSheet
        lead={selectedLead}
        funds={funds}
        entityId={entityId}
        assetManagerId={assetManagerId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={handleLeadUpdated}
      />

      <ConvertToInvestorDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        lead={convertLead}
        funds={funds}
        assetManagerEntityId={entityId}
        onConverted={(updatedLead) => {
          handleLeadUpdated(updatedLead);
          setConvertDialogOpen(false);
        }}
      />
    </>
  );
}
