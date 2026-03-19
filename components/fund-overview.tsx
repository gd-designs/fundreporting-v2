"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Users,
  Layers,
  TrendingUp,
  RefreshCcw,
  ArrowLeftRight,
  Table,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/date-input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  fetchShareClasses,
  fetchCapTableEntries,
  fetchCapitalCalls,
  type ShareClass,
  type CapTableEntry,
  type CapitalCall,
} from "@/lib/cap-table";

// ─── Types ────────────────────────────────────────────────────────────────────

type FundPeriod = {
  id: string;
  entity?: string | null;
  status?: "open" | "closed" | null;
  label?: string | null;
  opened_at?: number | null;
  closed_at?: number | null;
  nav_start?: number | null;
  total_shares_start?: number | null;
  nav_end?: number | null;
  total_shares_end?: number | null;
  total_aum_start?: number | null;
  total_aum_end?: number | null;
  created_at?: number | null;
};

type InvestorGroup = {
  capTableEntryId: string;
  name: string | null;
  email: string | null;
  shareClassId: string | null;
  shareClassName: string | null;
  currentNav: number | null;
  entryFeeRate: number; // fraction e.g. 0.01 = 1%
  totalAmount: number; // sum of undeployed paid calls (net)
  feeAmount: number;
  amountForShares: number;
  sharesIssued: number | null;
  calls: CapitalCall[];
};

type WalkthroughStep = "share_class" | "investors" | "capital" | "period";

type WalkthroughState =
  | { kind: "no_share_class" }
  | { kind: "no_investors" }
  | { kind: "awaiting_payment" }
  | { kind: "ready_to_open"; groups: InvestorGroup[] }
  | { kind: "period_open"; period: FundPeriod; groups: InvestorGroup[] }
  | { kind: "all_periods_closed"; groups: InvestorGroup[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtCcy(n: number | null | undefined, code = "EUR") {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function fetchPeriods(entityUUID: string): Promise<FundPeriod[]> {
  const res = await fetch(`/api/fund-periods?entity=${entityUUID}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

function buildInvestorGroups(
  calls: CapitalCall[],
  entries: CapTableEntry[],
  shareClasses: ShareClass[],
): InvestorGroup[] {
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const scMap = new Map(shareClasses.map((s) => [s.id, s]));
  const grouped = new Map<string, InvestorGroup>();

  const undeployedPaid = calls.filter(
    (c) => c.status === "paid" && !c.deployed_at,
  );

  for (const call of undeployedPaid) {
    if (!call.cap_table_entry) continue;
    const entryId = call.cap_table_entry;
    const entry = entryMap.get(entryId);

    if (!grouped.has(entryId)) {
      const shareholder = call._cap_table_entry?._shareholder;
      const shareClassId = call.share_class ?? entry?.share_class ?? null;
      const sc = shareClassId ? scMap.get(shareClassId) : null;

      // Find entry fee from share class fees
      const entryFee = sc?._share_class_fee?.find((f) => f.type === "entry");
      const entryFeeRate = entryFee?.rate ?? 0;

      grouped.set(entryId, {
        capTableEntryId: entryId,
        name: shareholder?.name ?? null,
        email: shareholder?.email ?? null,
        shareClassId,
        shareClassName: sc?.name ?? null,
        currentNav: sc?.current_nav ?? null,
        entryFeeRate,
        totalAmount: 0,
        feeAmount: 0,
        amountForShares: 0,
        sharesIssued: null,
        calls: [],
      });
    }

    const g = grouped.get(entryId)!;
    g.calls.push(call);
    g.totalAmount += call.amount ?? 0;
  }

  // Calculate derived amounts
  for (const g of grouped.values()) {
    g.feeAmount = g.totalAmount * g.entryFeeRate;
    g.amountForShares = g.totalAmount - g.feeAmount;
    g.sharesIssued =
      g.currentNav && g.currentNav > 0
        ? g.amountForShares / g.currentNav
        : null;
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );
}

function computeState(
  shareClasses: ShareClass[],
  entries: CapTableEntry[],
  calls: CapitalCall[],
  periods: FundPeriod[],
): WalkthroughState {
  const groups = buildInvestorGroups(calls, entries, shareClasses);
  const openPeriod = periods.find((p) => p.status === "open") ?? null;

  if (shareClasses.length === 0) return { kind: "no_share_class" };
  if (entries.length === 0 && calls.length === 0)
    return { kind: "no_investors" };

  const hasPaidCalls = calls.some((c) => c.status === "paid");
  if (!hasPaidCalls) return { kind: "awaiting_payment" };

  if (openPeriod) return { kind: "period_open", period: openPeriod, groups };

  if (groups.length > 0) return { kind: "ready_to_open", groups };

  return { kind: "all_periods_closed", groups };
}

function activeStep(state: WalkthroughState): WalkthroughStep {
  switch (state.kind) {
    case "no_share_class":
      return "share_class";
    case "no_investors":
      return "investors";
    case "awaiting_payment":
      return "capital";
    default:
      return "period";
  }
}

const STEPS: { key: WalkthroughStep; label: string }[] = [
  { key: "share_class", label: "Share class" },
  { key: "investors", label: "Investors" },
  { key: "capital", label: "Capital received" },
  { key: "period", label: "Period open" },
];

const STEP_ORDER: WalkthroughStep[] = [
  "share_class",
  "investors",
  "capital",
  "period",
];

// ─── Open Period Dialog ───────────────────────────────────────────────────────

function OpenPeriodDialog({
  open,
  onClose,
  entityUUID,
  currencyCode,
  groups,
  previousPeriod,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  entityUUID: string;
  currencyCode: string;
  groups: InvestorGroup[];
  previousPeriod?: FundPeriod | null;
  onSuccess: () => void;
}) {
  const [label, setLabel] = React.useState("");
  const [openedAt, setOpenedAt] = React.useState<Date | undefined>(new Date());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalInvested = groups.reduce((s, g) => s + g.amountForShares, 0);
  const totalShares = groups.reduce((s, g) => s + (g.sharesIssued ?? 0), 0);

  // Opening state: carry forward from last closed period, else derive from subscription mutations
  const navStart = previousPeriod?.nav_end ?? groups[0]?.currentNav ?? null;
  const totalSharesStart = previousPeriod?.total_shares_end ?? 0;
  const totalAumStart = previousPeriod != null
    ? (previousPeriod.total_aum_end ?? null)
    : totalInvested > 0 ? totalInvested : null;

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      // 1. Create the fund_period
      const periodRes = await fetch("/api/fund-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: entityUUID,
          status: "open",
          label: label || null,
          opened_at: openedAt ? openedAt.getTime() : Date.now(),
          ...(navStart != null ? { nav_start: navStart } : {}),
          total_shares_start: totalSharesStart,
          ...(totalAumStart != null ? { total_aum_start: totalAumStart } : {}),
        }),
      });
      if (!periodRes.ok) throw new Error("Failed to create period");
      const period = (await periodRes.json()) as { id: string };

      // 2. Create one fund_mutation per investor group
      for (const group of groups) {
        const mutRes = await fetch("/api/fund-mutations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID,
            period: period.id,
            cap_table_entry: group.capTableEntryId,
            type: "subscription",
            mutation_at: openedAt ? openedAt.getTime() : Date.now(),
            nav_per_share: group.currentNav,
            amount_invested: group.totalAmount,
            fee_rate: group.entryFeeRate,
            fee_amount: group.feeAmount,
            amount_for_shares: group.amountForShares,
            shares_issued: group.sharesIssued,
            shares_rounding: "none",
          }),
        });
        if (!mutRes.ok)
          throw new Error(
            `Failed to create mutation for ${group.name ?? group.capTableEntryId}`,
          );
        const mutation = (await mutRes.json()) as { id: string };

        // 3. Mark each capital call as deployed
        for (const call of group.calls) {
          await fetch(`/api/capital-calls/${call.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deployed_at: Date.now(),
              fund_mutation: mutation.id,
            }),
          });
        }
      }

      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open New Period</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This will create subscription mutations for {groups.length} investor
            {groups.length !== 1 ? "s" : ""} and open the period.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Period settings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Period label</label>
              <Input
                placeholder="e.g. Q1 2025"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <DatePickerInput
                id="period-opened-at"
                value={openedAt}
                onChange={setOpenedAt}
                label="Start date"
              />
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Investors</p>
              <p className="text-lg font-semibold mt-0.5">{groups.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total subscribed</p>
              <p className="text-lg font-semibold mt-0.5">
                {fmtCcy(totalInvested, currencyCode)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total shares</p>
              <p className="text-lg font-semibold mt-0.5">{fmt(totalShares)}</p>
            </div>
          </div>

          {/* Per-investor table */}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                    Investor
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                    Share class
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">
                    Amount
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">
                    Entry fee
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">
                    Net for shares
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">
                    Shares @ NAV
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr
                    key={g.capTableEntryId}
                    className="border-b last:border-0"
                  >
                    <td className="py-2 px-3">
                      <div className="font-medium">{g.name ?? "—"}</div>
                      {g.email && (
                        <div className="text-xs text-muted-foreground">
                          {g.email}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {g.shareClassName ?? "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmtCcy(g.totalAmount, currencyCode)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {g.entryFeeRate > 0
                        ? fmtCcy(g.feeAmount, currencyCode)
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">
                      {fmtCcy(g.amountForShares, currencyCode)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {g.sharesIssued != null ? (
                        <div>
                          <span className="font-medium">
                            {fmt(g.sharesIssued)}
                          </span>
                          {g.currentNav != null && (
                            <div className="text-xs text-muted-foreground">
                              @ {fmtCcy(g.currentNav, currencyCode)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          No NAV set
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? <Spinner className="size-4 mr-2" /> : null}
            Open period &amp; deploy capital
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Walkthrough Panel ────────────────────────────────────────────────────────

function WalkthroughPanel({
  state,
  capTableUrl,
  currencyCode,
  entityUUID,
  onOpenPeriod,
}: {
  state: WalkthroughState;
  capTableUrl: string;
  currencyCode: string;
  entityUUID: string;
  onOpenPeriod: () => void;
}) {
  const current = activeStep(state);
  const currentIdx = STEP_ORDER.indexOf(current);

  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-6">
      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map(({ key, label }, i) => {
          const idx = STEP_ORDER.indexOf(key);
          const done = idx < currentIdx;
          const active = idx === currentIdx;

          return (
            <React.Fragment key={key}>
              <div className="flex items-center gap-1.5 min-w-0">
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                ) : active ? (
                  <Circle className="size-4 shrink-0 text-primary fill-primary/10" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/30" />
                )}
                <span
                  className={`text-xs font-medium truncate ${
                    done
                      ? "text-emerald-600"
                      : active
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="size-3 mx-2 shrink-0 text-muted-foreground/20" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* State-specific content */}
      {state.kind === "no_share_class" && (
        <NoShareClassPanel capTableUrl={capTableUrl} />
      )}
      {state.kind === "no_investors" && (
        <NoInvestorsPanel capTableUrl={capTableUrl} />
      )}
      {state.kind === "awaiting_payment" && (
        <AwaitingPaymentPanel capTableUrl={capTableUrl} />
      )}
      {(state.kind === "ready_to_open" ||
        state.kind === "all_periods_closed") && (
        <ReadyToOpenPanel
          groups={state.groups}
          currencyCode={currencyCode}
          onOpen={onOpenPeriod}
        />
      )}
      {state.kind === "period_open" && (
        <PeriodOpenPanel
          period={state.period}
          groups={state.groups}
          currencyCode={currencyCode}
        />
      )}
    </div>
  );
}

function NoShareClassPanel({ capTableUrl }: { capTableUrl: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-100 p-2 shrink-0">
          <Layers className="size-4 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Define a share class</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Before onboarding investors, you need at least one share class with
            a starting NAV per share.
          </p>
        </div>
      </div>
      <div>
        <Button asChild size="sm">
          <Link href={capTableUrl}>
            Go to Cap Table <ArrowRight className="size-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function NoInvestorsPanel({ capTableUrl }: { capTableUrl: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-blue-100 p-2 shrink-0">
          <Users className="size-4 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Add your first investor</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a cap table entry and issue a capital call to onboard your first
            investor.
          </p>
        </div>
      </div>
      <div>
        <Button asChild size="sm">
          <Link href={capTableUrl}>
            Go to Cap Table <ArrowRight className="size-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AwaitingPaymentPanel({ capTableUrl }: { capTableUrl: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-yellow-100 p-2 shrink-0">
          <AlertCircle className="size-4 text-yellow-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">
            Awaiting capital call payment
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capital calls have been issued but none are marked as paid yet. Once
            an investor pays, you can open the first period and deploy capital.
          </p>
        </div>
      </div>
      <div>
        <Button asChild size="sm" variant="outline">
          <Link href={capTableUrl}>
            View capital calls <ArrowRight className="size-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ReadyToOpenPanel({
  groups,
  currencyCode,
  onOpen,
}: {
  groups: InvestorGroup[];
  currencyCode: string;
  onOpen: () => void;
}) {
  const totalAmount = groups.reduce((s, g) => s + g.amountForShares, 0);
  const missingNav = groups.some((g) => g.sharesIssued == null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-100 p-2 shrink-0">
          <CalendarDays className="size-4 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Ready to open period</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {groups.length} investor{groups.length !== 1 ? "s" : ""} with{" "}
            <span className="font-medium text-foreground">
              {fmtCcy(totalAmount, currencyCode)}
            </span>{" "}
            of paid capital waiting to be deployed. Opening a period will create
            subscription mutations and mark calls as deployed.
          </p>
          {missingNav && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="size-3" />
              Some share classes have no current NAV set — shares cannot be
              calculated until NAV is set.
            </p>
          )}
        </div>
      </div>
      <div>
        <Button size="sm" onClick={onOpen}>
          Open period &amp; deploy capital{" "}
          <ArrowRight className="size-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function PeriodOpenPanel({
  period,
  groups,
  currencyCode,
}: {
  period: FundPeriod;
  groups: InvestorGroup[];
  currencyCode: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-100 p-2 shrink-0">
          <CheckCircle2 className="size-4 text-emerald-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">
              {period.label ?? "Current period"}
            </h3>
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
              Open
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Opened {fmtDate(period.opened_at)}
            {period.total_shares_start != null &&
              ` · ${fmt(period.total_shares_start)} shares at start`}
            {period.nav_start != null &&
              ` · NAV ${fmtCcy(period.nav_start, currencyCode)}`}
          </p>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="rounded-lg border p-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Pending undeployed capital
          </p>
          <p className="text-sm">
            {groups.length} investor{groups.length !== 1 ? "s" : ""} with new
            paid calls waiting for next period deployment.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Quick links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    key: "cap-table",
    label: "Cap Table",
    description: "Shareholders and capital calls",
    icon: Table,
  },
  {
    key: "transactions",
    label: "Transactions",
    description: "All recorded movements",
    icon: ArrowLeftRight,
  },
  {
    key: "mutations",
    label: "Mutations",
    description: "Asset value mutations",
    icon: RefreshCcw,
  },
  {
    key: "profit-and-loss",
    label: "Profit & Loss",
    description: "Income and expense summary",
    icon: TrendingUp,
  },
  {
    key: "net-asset-value",
    label: "Net Asset Value",
    description: "NAV over time",
    icon: BarChart3,
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function FundOverview({
  entityUUID,
  fundId,
  amId,
  currencyCode = "EUR",
}: {
  entityUUID: string;
  fundId: string;
  amId: string;
  currencyCode?: string;
}) {
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([]);
  const [entries, setEntries] = React.useState<CapTableEntry[]>([]);
  const [calls, setCalls] = React.useState<CapitalCall[]>([]);
  const [periods, setPeriods] = React.useState<FundPeriod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [openDialog, setOpenDialog] = React.useState(false);

  const base = `/asset-manager/${amId}/fund/${fundId}`;
  const capTableUrl = `${base}/cap-table`;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [sc, en, ca, pe] = await Promise.all([
        fetchShareClasses(entityUUID),
        fetchCapTableEntries(entityUUID),
        fetchCapitalCalls(entityUUID),
        fetchPeriods(entityUUID),
      ]);
      setShareClasses(sc);
      setEntries(en);
      setCalls(ca);
      setPeriods(pe);
    } finally {
      setLoading(false);
    }
  }, [entityUUID]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    );
  }

  const state = computeState(shareClasses, entries, calls, periods);
  const groups =
    state.kind === "ready_to_open" ||
    state.kind === "period_open" ||
    state.kind === "all_periods_closed"
      ? state.groups
      : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Walkthrough / current state */}
      <WalkthroughPanel
        state={state}
        capTableUrl={capTableUrl}
        currencyCode={currencyCode}
        entityUUID={entityUUID}
        onOpenPeriod={() => setOpenDialog(true)}
      />

      {/* Quick links */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Fund sections
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ key, label, description, icon: Icon }) => (
            <Link
              key={key}
              href={`${base}/${key}`}
              className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">{label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Open period dialog */}
      <OpenPeriodDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        entityUUID={entityUUID}
        currencyCode={currencyCode}
        groups={groups}
        previousPeriod={periods.filter((p) => p.status === "closed").sort((a, b) => (b.opened_at ?? 0) - (a.opened_at ?? 0))[0] ?? null}
        onSuccess={load}
      />
    </div>
  );
}
