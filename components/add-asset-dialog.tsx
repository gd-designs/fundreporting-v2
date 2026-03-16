"use client";

import * as React from "react";
import { Maximize2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerInput } from "@/components/date-input";
import { DateTimePickerInput } from "@/components/date-time-input";
import {
  searchMarket,
  fetchMarketPriceAt,
  type MarketSearchResult,
} from "@/lib/market";
import type { Currency, AssetClass } from "@/lib/types";
import { notifyLedgerUpdate } from "@/lib/ledger-events";

// ─── Types ────────────────────────────────────────────────────────────────────

type Country = { id: number; name: string; code: string; emoji?: string };
type FundingSource = "own_funds" | "external_capital" | "leveraged";
type PaymentScheme = "linear" | "bullet" | "annuity";
type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "bi-annually" | "annually";

type Period = {
  period: number;
  opening: number;
  payment: number;
  interest: number;
  principal: number;
  closing: number;
};

const COUNTRY_ALIASES: Record<string, string> = {
  USA: "US",
  UK: "GB",
  UAE: "AE",
};

// Maps EODHD exchange codes → ISO 3166-1 alpha-2 country codes
const EXCHANGE_TO_COUNTRY: Record<string, string> = {
  US: "US", NASDAQ: "US", NYSE: "US", AMEX: "US", BATS: "US",
  LSE: "GB",
  XETRA: "DE", F: "DE", BE: "DE", MU: "DE", DU: "DE", HM: "DE",
  PA: "FR", ENX: "FR",
  AS: "NL",
  BR: "BE",
  LI: "PT",
  SW: "CH",
  TO: "CA", V: "CA", NEO: "CA",
  AX: "AU",
  NZ: "NZ",
  HK: "HK",
  T: "JP", OS: "JP",
  SS: "CN", SZ: "CN",
  NSE: "IN", BSE: "IN",
  KO: "KR", KQ: "KR",
  ST: "SE",
  OL: "NO",
  CO: "DK",
  HE: "FI",
  MC: "ES",
  MI: "IT", TI: "IT",
  AT: "GR",
  IS: "TR",
  SA: "BR",
  MX: "MX",
  SG: "SG",
  JSE: "ZA",
  BK: "TH",
  KL: "MY",
  JK: "ID",
  TA: "IL",
  DFM: "AE", ADX: "AE",
};
const FREQUENCY_PERIODS: Record<Frequency, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  "bi-annually": 2,
  annually: 1,
};

function termUnitLabel(freq: Frequency): string {
  switch (freq) {
    case "daily": return "days"
    case "weekly": return "weeks"
    case "monthly": return "months"
    case "quarterly": return "quarters"
    case "bi-annually": return "half-years"
    case "annually": return "years"
  }
}

// ─── Amortization calculators ─────────────────────────────────────────────────

function computeLinear(
  p: number,
  r: number,
  freq: Frequency,
  numPeriods: number,
): Period[] {
  const n = numPeriods;
  const rate = r / 100 / FREQUENCY_PERIODS[freq];
  const principalPer = p / n;
  const result: Period[] = [];
  let opening = p;
  for (let i = 1; i <= n; i++) {
    const interest = opening * rate;
    const closing = Math.max(0, opening - principalPer);
    result.push({
      period: i,
      opening,
      payment: principalPer + interest,
      interest,
      principal: principalPer,
      closing,
    });
    opening = closing;
  }
  return result;
}

function computeBullet(
  p: number,
  r: number,
  freq: Frequency,
  numPeriods: number,
): Period[] {
  const n = numPeriods;
  const rate = r / 100 / FREQUENCY_PERIODS[freq];
  return Array.from({ length: n }, (_, idx) => {
    const i = idx + 1;
    const isLast = i === n;
    const interest = p * rate;
    return {
      period: i,
      opening: p,
      payment: interest + (isLast ? p : 0),
      interest,
      principal: isLast ? p : 0,
      closing: isLast ? 0 : p,
    };
  });
}

function computeAnnuity(
  p: number,
  r: number,
  freq: Frequency,
  numPeriods: number,
): Period[] {
  const n = numPeriods;
  const rate = r / 100 / FREQUENCY_PERIODS[freq];
  const pmt =
    rate === 0
      ? p / n
      : (p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
  const periods: Period[] = [];
  let opening = p;
  for (let i = 1; i <= n; i++) {
    const interest = opening * rate;
    const principal = pmt - interest;
    const closing = Math.max(0, opening - principal);
    periods.push({
      period: i,
      opening,
      payment: pmt,
      interest,
      principal,
      closing,
    });
    opening = closing;
  }
  return periods;
}

function fmtNum(v: number) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Amortization full-schedule dialog ────────────────────────────────────────

function AmortizationDialog({
  scheme,
  periods,
  open,
  onClose,
}: {
  scheme: PaymentScheme;
  periods: Period[];
  open: boolean;
  onClose: () => void;
}) {
  const label =
    scheme === "linear" ? "Linear" : scheme === "bullet" ? "Bullet" : "Annuity";
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{label} — Full amortization schedule</DialogTitle>
          <DialogDescription>
            Breakdown of all {periods.length} payment periods.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 bg-background border-b text-muted-foreground">
              <tr>
                {[
                  "#",
                  "Opening",
                  "Payment",
                  "Interest",
                  "Principal",
                  "Closing",
                ].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 font-medium ${h !== "#" ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.period} className="border-b last:border-0">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {p.period}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {fmtNum(p.opening)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right font-medium">
                    {fmtNum(p.payment)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-rose-500">
                    {fmtNum(p.interest)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {fmtNum(p.principal)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {fmtNum(p.closing)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Amortization scheme card ─────────────────────────────────────────────────

function SchemeCard({
  scheme,
  periods,
  selected,
  onSelect,
  onExpand,
}: {
  scheme: PaymentScheme;
  periods: Period[];
  selected: boolean;
  onSelect: () => void;
  onExpand: () => void;
}) {
  const label =
    scheme === "linear" ? "Linear" : scheme === "bullet" ? "Bullet" : "Annuity";
  const description =
    scheme === "linear"
      ? "Equal principal repayments, decreasing interest"
      : scheme === "bullet"
        ? "Interest-only payments, full principal at maturity"
        : "Fixed equal payments throughout the term";

  const totalPayment = periods.reduce((s, p) => s + p.payment, 0);
  const totalInterest = periods.reduce((s, p) => s + p.interest, 0);
  const firstPayment = periods[0]?.payment ?? 0;
  const lastPayment = periods[periods.length - 1]?.payment ?? 0;

  return (
    <div
      className={`relative rounded-lg border p-4 cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
      onClick={onSelect}
    >
      <button
        type="button"
        title="View full schedule"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
      >
        <Maximize2 className="size-3.5" />
      </button>
      <p className="font-semibold text-sm mb-0.5">{label}</p>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Total cost</p>
          <p className="font-medium tabular-nums">{fmtNum(totalPayment)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total interest</p>
          <p className="font-medium tabular-nums text-rose-500">
            {fmtNum(totalInterest)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">
            {scheme === "bullet" ? "Final payment" : "Last payment"}
          </p>
          <p className="font-medium tabular-nums">{fmtNum(lastPayment)}</p>
        </div>
      </div>
      {scheme !== "bullet" && Math.abs(firstPayment - lastPayment) > 0.01 && (
        <p className="text-xs text-muted-foreground mt-2">
          First: {fmtNum(firstPayment)} → Last: {fmtNum(lastPayment)}
        </p>
      )}
      {selected && (
        <div className="mt-3 pt-2 border-t">
          <span className="text-xs text-primary font-medium">Selected</span>
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
  entityUUID: string;
  currencies: Currency[];
  assetClasses: AssetClass[];
  onCreated: () => void;
  allowNewMoneyIn?: boolean;
  defaultCurrencyCode?: string;
  entityType?: string;
};

export function AddAssetDialog({
  children,
  entityUUID,
  currencies,
  assetClasses,
  onCreated,
  allowNewMoneyIn = false,
  defaultCurrencyCode,
  entityType,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Default currency on open (first open has currencyId=null; reset() handles subsequent opens)
  React.useEffect(() => {
    if (!open || !defaultCurrencyCode) return
    setCurrencyId((prev) => {
      if (prev != null) return prev
      return currencies.find((c) => c.code?.toUpperCase() === defaultCurrencyCode.toUpperCase())?.id ?? null
    })
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 1
  const [source, setSource] = React.useState<"manual" | "live-ticker" | null>(
    null,
  );

  // Step 2 — common
  const [assetClassId, setAssetClassId] = React.useState<number | null>(null);
  const [countryId, setCountryId] = React.useState<number | null>(null);
  const [currencyId, setCurrencyId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [purchaseAmount, setPurchaseAmount] = React.useState("");
  const [indicativeRate, setIndicativeRate] = React.useState("");
  const quantityRef = React.useRef(quantity);
  React.useEffect(() => { quantityRef.current = quantity; }, [quantity]);

  // Linked field handlers: changing any one recomputes a third from the other two
  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuantity(val);
    const qty = parseFloat(val);
    const rate = parseFloat(indicativeRate);
    if (isFinite(qty) && qty > 0 && isFinite(rate) && rate > 0) {
      setPurchaseAmount((qty * rate).toFixed(2));
    }
  }
  function handlePurchaseAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setPurchaseAmount(val);
    const amount = parseFloat(val);
    const qty = parseFloat(quantity);
    const rate = parseFloat(indicativeRate);
    if (isFinite(amount) && amount > 0) {
      if (isLiveTicker) {
        // Rate is locked to market price — derive quantity instead
        if (isFinite(rate) && rate > 0) {
          setQuantity((amount / rate).toFixed(6));
        }
      } else {
        if (isFinite(qty) && qty > 0) {
          setIndicativeRate((amount / qty).toFixed(4));
        } else if (isFinite(rate) && rate > 0) {
          setQuantity((amount / rate).toFixed(6));
        }
      }
    }
  }
  function handleIndicativeRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setIndicativeRate(val);
    const rate = parseFloat(val);
    const qty = parseFloat(quantity);
    const amount = parseFloat(purchaseAmount);
    if (isFinite(rate) && rate > 0) {
      if (isFinite(qty) && qty > 0) {
        setPurchaseAmount((qty * rate).toFixed(2));
      } else if (isFinite(amount) && amount > 0) {
        setQuantity((amount / rate).toFixed(6));
      }
    }
  }
  const [purchasedAt, setPurchasedAt] = React.useState<Date | undefined>(
    undefined,
  );
  const [autoRecordCashIn, setAutoRecordCashIn] = React.useState(false);

  // Step 2 — live ticker
  const [tickerQuery, setTickerQuery] = React.useState("");
  const [tickerResults, setTickerResults] = React.useState<
    MarketSearchResult[]
  >([]);
  const [tickerLoading, setTickerLoading] = React.useState(false);
  const [selectedTicker, setSelectedTicker] =
    React.useState<MarketSearchResult | null>(null);
  const [tickerLockedCurrency, setTickerLockedCurrency] = React.useState(false);
  const [tickerLockedCountry, setTickerLockedCountry] = React.useState(false);
  const [autoPriceLoading, setAutoPriceLoading] = React.useState(false);
  const [autoPriceSource, setAutoPriceSource] = React.useState<string | null>(
    null,
  );
  const [autoPriceError, setAutoPriceError] = React.useState<string | null>(
    null,
  );

  // Step 3 — funding
  const requiresCapitalCheck = !allowNewMoneyIn;
  const [cashAssets, setCashAssets] = React.useState<
    Array<{ id: string; name: string | null; currency: number | null }>
  >([]);
  const [cashAssetId, setCashAssetId] = React.useState("");
  const [cashBalances, setCashBalances] = React.useState<Map<string, number>>(new Map());
  const [createNewCashAccount, setCreateNewCashAccount] = React.useState(false);
  const [recordNewMoneyIn, setRecordNewMoneyIn] = React.useState(true);
  const [fundingSource, setFundingSource] =
    React.useState<FundingSource | null>(null);
  const [loanName, setLoanName] = React.useState("");
  const [loanAmount, setLoanAmount] = React.useState("");
  const [interestRate, setInterestRate] = React.useState("");
  const [frequency, setFrequency] = React.useState<Frequency>("annually");
  const [termLength, setTermLength] = React.useState("");
  const [selectedScheme, setSelectedScheme] =
    React.useState<PaymentScheme | null>(null);
  const [loanReference, setLoanReference] = React.useState("");
  const [loanStartAt, setLoanStartAt] = React.useState<Date | undefined>(
    undefined,
  );
  const [expandedScheme, setExpandedScheme] =
    React.useState<PaymentScheme | null>(null);

  // Step 3 — remainder funding (when loanAmount < purchaseAmount)
  const [remainderFundingSource, setRemainderFundingSource] = React.useState<"own_funds" | "leveraged" | null>(null);
  const [remainderCashAssetId, setRemainderCashAssetId] = React.useState("");
  const [remainderRecordNewMoneyIn, setRemainderRecordNewMoneyIn] = React.useState(true);
  const [loan2Name, setLoan2Name] = React.useState("");
  const [loan2Amount, setLoan2Amount] = React.useState("");
  const [loan2InterestRate, setLoan2InterestRate] = React.useState("");
  const [loan2Frequency, setLoan2Frequency] = React.useState<Frequency>("annually");
  const [loan2TermLength, setLoan2TermLength] = React.useState("");
  const [loan2Scheme, setLoan2Scheme] = React.useState<PaymentScheme | null>(null);
  const [loan2Reference, setLoan2Reference] = React.useState("");
  const [loan2StartAt, setLoan2StartAt] = React.useState<Date | undefined>(undefined);
  const [expandedScheme2, setExpandedScheme2] = React.useState<PaymentScheme | null>(null);

  // Step 4 — documents
  const [files, setFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Options
  const [countries, setCountries] = React.useState<Country[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [ipCountryCode, setIpCountryCode] = React.useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const selectedAssetClassName =
    assetClasses.find((c) => c.id === assetClassId)?.name ?? "";
  const isCashClass = selectedAssetClassName.toLowerCase().includes("cash");
  const isLiveTicker = source === "live-ticker";
  const totalSteps = isLiveTicker ? 4 : isCashClass ? 3 : 4;
  // Cash manual skips funding step (step 3) — display step 4 as step 3
  const displayedStep = !isLiveTicker && isCashClass && step === 4 ? 3 : step;

  const visibleAssetClasses = React.useMemo(
    () =>
      isLiveTicker
        ? assetClasses.filter((c) => !c.name.toLowerCase().includes("cash"))
        : assetClasses,
    [assetClasses, isLiveTicker],
  );

  const schedules = React.useMemo<Record<
    PaymentScheme,
    Period[]
  > | null>(() => {
    if (fundingSource !== "leveraged") return null;
    const p = parseFloat(loanAmount);
    const r = parseFloat(interestRate);
    const t = parseInt(termLength, 10);
    if (
      !isFinite(p) ||
      p <= 0 ||
      !isFinite(r) ||
      r < 0 ||
      !isFinite(t) ||
      t <= 0
    )
      return null;
    return {
      linear: computeLinear(p, r, frequency, t),
      bullet: computeBullet(p, r, frequency, t),
      annuity: computeAnnuity(p, r, frequency, t),
    };
  }, [fundingSource, loanAmount, interestRate, frequency, termLength]);

  // Remainder when loanAmount < purchaseAmount
  const loanRemainder = fundingSource === "leveraged"
    ? Math.max(0, Number(purchaseAmount) - Number(loanAmount))
    : 0;
  const hasRemainder = loanRemainder > 0.001;

  const schedules2 = React.useMemo<Record<PaymentScheme, Period[]> | null>(() => {
    if (!hasRemainder || remainderFundingSource !== "leveraged") return null;
    const p = parseFloat(loan2Amount || String(loanRemainder));
    const r = parseFloat(loan2InterestRate);
    const t = parseInt(loan2TermLength, 10);
    if (!isFinite(p) || p <= 0 || !isFinite(r) || r < 0 || !isFinite(t) || t <= 0) return null;
    return {
      linear: computeLinear(p, r, loan2Frequency, t),
      bullet: computeBullet(p, r, loan2Frequency, t),
      annuity: computeAnnuity(p, r, loan2Frequency, t),
    };
  }, [hasRemainder, remainderFundingSource, loan2Amount, loan2InterestRate, loan2Frequency, loan2TermLength, loanRemainder]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCurrencyCode =
    currencies.find((c) => c.id === currencyId)?.code ?? "";
  const currencyMatchedCashAssets = cashAssets.filter(
    (a) => a.currency === currencyId,
  );
  // Step-independent: used in save() and step 3 UI
  // Applies to both live-ticker and manual when no currency-matched cash account exists
  const needsNewCashAccount =
    currencyMatchedCashAssets.length === 0 && !cashAssetId && !!currencyId;
  // Only show the amber notice when on step 3
  const showNewCashAccountNotice = step === 3 && needsNewCashAccount;
  // Remainder own_funds: no cash account exists for this currency
  const needsRemainderCashAccount =
    hasRemainder && remainderFundingSource === "own_funds" &&
    currencyMatchedCashAssets.length === 0 && !remainderCashAssetId && !!currencyId;

  // ── Validation ───────────────────────────────────────────────────────────────

  // For companies: cash balance must cover the purchase amount
  const selectedCashBalance = cashAssetId ? (cashBalances.get(cashAssetId) ?? 0) : 0;
  const insufficientCashBalance =
    requiresCapitalCheck &&
    fundingSource === "own_funds" &&
    !!cashAssetId &&
    !needsNewCashAccount &&
    Number(purchaseAmount) > 0 &&
    selectedCashBalance < Number(purchaseAmount);

  // Portfolio split funding: when "deplete cash balance" is selected but balance is short,
  // auto-split by recording new money in for the shortfall, then cash out the full amount.
  const splitAmount =
    allowNewMoneyIn &&
    !recordNewMoneyIn &&
    !needsNewCashAccount &&
    !!cashAssetId &&
    selectedCashBalance >= 0 &&
    Number(purchaseAmount) > 0 &&
    selectedCashBalance < Number(purchaseAmount)
      ? Number(purchaseAmount) - selectedCashBalance
      : 0;
  const needsSplit = splitAmount > 0;

  const canContinueStep2 = isLiveTicker
    ? !!selectedTicker && !!purchasedAt
    : !!assetClassId &&
      !!countryId &&
      !!currencyId &&
      name.trim().length > 0 &&
      (!isCashClass || !autoRecordCashIn || (Number(purchaseAmount) > 0 && !!purchasedAt));

  const canContinueStep3 = isLiveTicker
    ? !!assetClassId &&
      !!countryId &&
      !!currencyId &&
      name.trim().length > 0 &&
      !!fundingSource &&
      !insufficientCashBalance &&
      !(requiresCapitalCheck && needsNewCashAccount) &&
      (fundingSource === "leveraged"
        ? !!loanName.trim() && !!loanStartAt && !!schedules && !!selectedScheme
        : !!cashAssetId || createNewCashAccount || needsNewCashAccount)
    : !!fundingSource &&
      !insufficientCashBalance &&
      !(requiresCapitalCheck && needsNewCashAccount) &&
      (fundingSource !== "leveraged" ||
        (!!loanName.trim() &&
          !!loanStartAt &&
          !!schedules &&
          !!selectedScheme)) &&
      (!hasRemainder ||
        (!!remainderFundingSource &&
          (remainderFundingSource === "own_funds"
            ? !!remainderCashAssetId || needsRemainderCashAccount
            : !!loan2Name.trim() && !!loan2StartAt && !!schedules2 && !!loan2Scheme)));

  // ── Effects ───────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!open) return;
    setLoadingOptions(true);
    Promise.all([
      fetch("/api/countries").then((r) => (r.ok ? r.json() : [])),
      fetch("https://ipapi.co/json/")
        .then((r) => (r.ok ? r.json() : {}))
        .then((d: Record<string, unknown>) =>
          typeof d.country_code === "string" ? d.country_code : null,
        )
        .catch(() => null),
    ])
      .then(([c, code]: [Country[], string | null]) => {
        setCountries(c);
        setIpCountryCode(code);
        if (!countryId && c.length > 0) {
          const ipMatch = code
            ? c.find((x) => x.code?.toUpperCase() === code.toUpperCase())
            : null;
          setCountryId(ipMatch ? ipMatch.id : c[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingOptions(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill loan2Amount from remainder when it changes
  React.useEffect(() => {
    if (hasRemainder && loanRemainder > 0) {
      setLoan2Amount(loanRemainder.toFixed(2));
    }
  }, [hasRemainder, loanRemainder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill loan start date from purchase date when leveraged
  React.useEffect(() => {
    if (fundingSource === "leveraged" && purchasedAt && !loanStartAt) {
      setLoanStartAt(purchasedAt)
    }
  }, [fundingSource, purchasedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select first asset class
  React.useEffect(() => {
    if (!assetClassId && visibleAssetClasses.length > 0)
      setAssetClassId(visibleAssetClasses[0].id);
  }, [visibleAssetClasses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset asset class if current is hidden (e.g. cash when switching to live-ticker)
  React.useEffect(() => {
    if (!assetClassId) return;
    const visible = visibleAssetClasses.some((c) => c.id === assetClassId);
    if (!visible && visibleAssetClasses.length > 0)
      setAssetClassId(visibleAssetClasses[0].id);
  }, [assetClassId, visibleAssetClasses]);

  // Ticker search with debounce
  React.useEffect(() => {
    if (source !== "live-ticker") {
      setTickerResults([]);
      return;
    }
    const q = tickerQuery.trim();
    if (q.length < 2) {
      setTickerResults([]);
      setTickerLoading(false);
      return;
    }
    let cancelled = false;
    setTickerLoading(true);
    const id = setTimeout(async () => {
      try {
        const results = await searchMarket(q, 15);
        if (!cancelled) setTickerResults(results);
      } catch {
        if (!cancelled) setTickerResults([]);
      } finally {
        if (!cancelled) setTickerLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [source, tickerQuery]);

  // Auto-fill price when ticker + date change
  React.useEffect(() => {
    if (source !== "live-ticker" || !selectedTicker || !purchasedAt) {
      setAutoPriceSource(null);
      return;
    }
    const atMs = purchasedAt.getTime();
    if (!isFinite(atMs)) return;
    let cancelled = false;
    setAutoPriceLoading(true);
    setAutoPriceError(null);
    const id = setTimeout(async () => {
      try {
        const result = await fetchMarketPriceAt(selectedTicker.ticker, atMs);
        if (cancelled) return;
        const rate = Number(result.price);
        if (!isFinite(rate) || rate <= 0) {
          setAutoPriceSource(null);
          return;
        }
        setIndicativeRate(rate.toFixed(4));
        const qty = Number(quantityRef.current) > 0 ? Number(quantityRef.current) : 1;
        setPurchaseAmount((rate * qty).toFixed(2));
        setAutoPriceSource(result.source);
      } catch (err) {
        if (cancelled) return;
        setAutoPriceError(
          err instanceof Error ? err.message : "Could not auto-fill price.",
        );
      } finally {
        if (!cancelled) setAutoPriceLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [source, selectedTicker, purchasedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cash assets when entering funding step (both manual and live ticker)
  React.useEffect(() => {
    if (step !== 3) return;
    const cashClassIds = new Set(
      assetClasses
        .filter((c) => c.name.toLowerCase().includes("cash"))
        .map((c) => c.id),
    );

    const fetchAssets = fetch(`/api/assets?entity=${entityUUID}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Array<{ id: string; name: string | null; asset_class: number | null; currency: number | null }>) =>
        all.filter((a) => a.asset_class != null && cashClassIds.has(a.asset_class))
      );

    if (requiresCapitalCheck) {
      // For companies, also compute cash account balances from transaction entries + mutations
      Promise.all([
        fetchAssets,
        fetch(`/api/transaction-entries?entity=${entityUUID}`).then((r) => r.ok ? r.json() : { entries: [] }).catch(() => ({ entries: [] })),
        fetch(`/api/mutations?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]).then(([assets, entriesPayload, mutationsData]: [typeof cashAssets, { entries?: unknown[] }, Array<Record<string, unknown>>]) => {
        setCashAssets(assets);
        const cashIds = new Set(assets.map((a) => a.id));
        const balances = new Map<string, number>();
        const rawEntries = Array.isArray((entriesPayload as { entries?: unknown[] }).entries)
          ? (entriesPayload as { entries: Record<string, unknown>[] }).entries
          : [];
        for (const e of rawEntries) {
          const assetId = typeof e.asset === "string" ? e.asset : typeof e.object_id === "string" && e.object_type === "asset" ? e.object_id : null;
          if (!assetId || !cashIds.has(assetId)) continue;
          const dir = e.direction === "in" ? 1 : -1;
          const amount = typeof e.amount === "number" ? e.amount : 0;
          balances.set(assetId, (balances.get(assetId) ?? 0) + dir * amount);
        }
        for (const m of mutationsData) {
          const assetId = typeof m.asset === "string" ? m.asset : null;
          if (!assetId || !cashIds.has(assetId)) continue;
          const delta = typeof m.delta === "number" ? m.delta : 0;
          balances.set(assetId, (balances.get(assetId) ?? 0) + delta);
        }
        setCashBalances(balances);
      }).catch(() => {});
    } else {
      fetchAssets.then(setCashAssets).catch(() => {});
    }
  }, [step, entityUUID, assetClasses, requiresCapitalCheck]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ────────────────────────────────────────────────────────────────

  function handleNext() {
    if (step === 2 && !isLiveTicker && isCashClass) setStep(4);
    else setStep((s) => s + 1);
  }

  function handleBack() {
    if (step === 4 && !isLiveTicker && isCashClass) setStep(2);
    else {
      // Going back to step 1 — clear all ticker-populated fields so
      // switching from live-ticker to manual starts clean
      if (step === 2) {
        setSelectedTicker(null);
        setTickerQuery("");
        setTickerResults([]);
        setTickerLockedCurrency(false);
        setTickerLockedCountry(false);
        setName("");
        setAssetClassId(null);
        setCountryId(null);
        setCurrencyId(defaultCurrencyCode
          ? (currencies.find((c) => c.code?.toUpperCase() === defaultCurrencyCode.toUpperCase())?.id ?? null)
          : null);
        setQuantity("");
        setPurchaseAmount("");
        setIndicativeRate("");
        setPurchasedAt(undefined);
      }
      setStep((s) => s - 1);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────

  function reset() {
    setStep(1);
    setSource(null);
    setAssetClassId(null);
    setCountryId(null);
    setCurrencyId(defaultCurrencyCode
      ? (currencies.find((c) => c.code?.toUpperCase() === defaultCurrencyCode.toUpperCase())?.id ?? null)
      : null);
    setName("");
    setDescription("");
    setQuantity("");
    setPurchaseAmount("");
    setIndicativeRate("");
    setPurchasedAt(undefined);
    setAutoRecordCashIn(false);
    setTickerQuery("");
    setTickerResults([]);
    setTickerLoading(false);
    setSelectedTicker(null);
    setTickerLockedCurrency(false);
    setTickerLockedCountry(false);
    setAutoPriceLoading(false);
    setAutoPriceSource(null);
    setAutoPriceError(null);
    setCashAssets([]);
    setCashAssetId("");
    setCreateNewCashAccount(false);
    setRecordNewMoneyIn(true);
    setFundingSource(null);
    setLoanName("");
    setLoanAmount("");
    setInterestRate("");
    setFrequency("annually");
    setTermLength("");
    setSelectedScheme(null);
    setLoanReference("");
    setLoanStartAt(undefined);
    setExpandedScheme(null);
    setRemainderFundingSource(null);
    setRemainderCashAssetId("");
    setRemainderRecordNewMoneyIn(true);
    setLoan2Name("");
    setLoan2Amount("");
    setLoan2InterestRate("");
    setLoan2Frequency("annually");
    setLoan2TermLength("");
    setLoan2Scheme(null);
    setLoan2Reference("");
    setLoan2StartAt(undefined);
    setExpandedScheme2(null);
    setFiles([]);
    setError(null);
  }

  // ── Ticker selection helper ───────────────────────────────────────────────────

  function selectTicker(result: MarketSearchResult) {
    setSelectedTicker(result);
    setTickerQuery("");
    setTickerResults([]);
    if (!name.trim()) setName(result.name);
    const matchedCurrency = currencies.find(
      (c) => c.code?.toUpperCase() === result.currency?.toUpperCase(),
    );
    if (matchedCurrency) {
      setCurrencyId(matchedCurrency.id);
      setTickerLockedCurrency(true);
    } else {
      setTickerLockedCurrency(false);
    }
    // Try exchange code first, then result.country, then IP fallback
    const exchangeCountryCode = result.exchange
      ? EXCHANGE_TO_COUNTRY[result.exchange.toUpperCase()]
      : undefined;
    const raw = (result.country || "").toUpperCase();
    const countryCodeFromResult = COUNTRY_ALIASES[raw] ?? raw;
    const matchedCountry =
      (exchangeCountryCode
        ? countries.find((c) => c.code?.toUpperCase() === exchangeCountryCode)
        : null) ??
      countries.find((c) => c.code?.toUpperCase() === countryCodeFromResult) ??
      countries.find((c) => c.name.toUpperCase() === raw);

    if (matchedCountry) {
      setCountryId(matchedCountry.id);
      setTickerLockedCountry(true);
    } else {
      setTickerLockedCountry(false);
      if (ipCountryCode) {
        const ipMatch = countries.find(
          (c) => c.code?.toUpperCase() === ipCountryCode.toUpperCase(),
        );
        if (ipMatch) setCountryId(ipMatch.id);
      }
    }
    if (!quantity) setQuantity("1");
    if (!purchasedAt) setPurchasedAt(new Date());

    // Auto-set class, currency, and country for .CC tickers
    if (result.ticker.toUpperCase().endsWith(".CC")) {
      const cryptoClass = assetClasses.find((c) =>
        c.name.toLowerCase().includes("crypto"),
      );
      if (cryptoClass) setAssetClassId(cryptoClass.id);

      // Extract currency from pattern like BTC-USD.CC
      const ccMatch = result.ticker.match(/^[^-]+-([A-Z]+)\.CC$/i);
      if (ccMatch) {
        const extractedCode = ccMatch[1].toUpperCase();
        const matched = currencies.find(
          (c) => c.code?.toUpperCase() === extractedCode,
        );
        if (matched) setCurrencyId(matched.id);
      }

      // Crypto has no exchange country — use IP-based preset (already set by fallback above)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function save() {
    setSubmitLoading(true);
    setError(null);
    try {
      // 1. Create asset (info only — no transactional fields)
      const assetPayload: Record<string, unknown> = {
        entity: entityUUID,
        name: name.trim() || selectedTicker?.name || "",
        ...(description.trim() && { description: description.trim() }),
        ...(currencyId && { currency: currencyId }),
        ...(countryId && { country: countryId }),
        ...(assetClassId && { asset_class: assetClassId }),
        ...(purchasedAt && { purchased_at: purchasedAt.getTime() }),
      };
      const assetRes = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assetPayload),
      });
      const assetData = (await assetRes.json()) as { id?: string; error?: string };
      if (!assetRes.ok) throw new Error(assetData.error ?? "Failed to create asset.");
      const assetId = assetData.id!;

      // 2. Upsert instrument and link to asset (live ticker only)
      if (isLiveTicker && selectedTicker) {
        const searchRes = await fetch(
          `/api/instruments?ticker=${encodeURIComponent(selectedTicker.ticker)}`,
        );
        const existing = searchRes.ok
          ? ((await searchRes.json()) as Array<{ id: string }>)
          : [];

        let instrumentId: string;
        if (existing.length > 0) {
          instrumentId = existing[0].id;
        } else {
          const createRes = await fetch("/api/instruments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticker: selectedTicker.ticker,
              symbol: selectedTicker.code,
              exchange: selectedTicker.exchange,
              name: selectedTicker.name,
              isin: selectedTicker.isin ?? undefined,
              currency_code: selectedTicker.currency,
              type: selectedTicker.type,
              source: "eodhd",
            }),
          });
          const createData = (await createRes.json()) as { id: string };
          instrumentId = createData.id;
        }

        await fetch(`/api/assets/${assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrument: instrumentId }),
        });
      }

      // 3. Create liability record (leveraged only)
      let liabilityId: string | null = null;
      if (fundingSource === "leveraged" && loanName.trim()) {
        const liabilityRes = await fetch("/api/liabilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID,
            asset: assetId,
            name: loanName.trim(),
            ...(loanReference.trim() && { reference: loanReference.trim() }),
            ...(loanAmount && { loan_amount: parseFloat(loanAmount) }),
            ...(interestRate && { interest_rate: parseFloat(interestRate) }),
            frequency,
            ...(termLength && { term_length: parseInt(termLength, 10) }),
            ...(selectedScheme && { scheme: selectedScheme }),
            ...(loanStartAt && { date: loanStartAt.getTime() }),
          }),
        });
        if (liabilityRes.ok) {
          const liabilityData = (await liabilityRes.json()) as { id: string };
          liabilityId = liabilityData.id;
        }
      }

      // 4. Create second liability if remainder funded by another loan
      let liability2Id: string | null = null;
      if (hasRemainder && remainderFundingSource === "leveraged" && loan2Name.trim()) {
        const remainder2Amount = parseFloat(loan2Amount) || loanRemainder;
        const liability2Res = await fetch("/api/liabilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID,
            asset: assetId,
            name: loan2Name.trim(),
            ...(loan2Reference.trim() && { reference: loan2Reference.trim() }),
            ...(remainder2Amount && { loan_amount: remainder2Amount }),
            ...(loan2InterestRate && { interest_rate: parseFloat(loan2InterestRate) }),
            frequency: loan2Frequency,
            ...(loan2TermLength && { term_length: parseInt(loan2TermLength, 10) }),
            ...(loan2Scheme && { scheme: loan2Scheme }),
            ...(loan2StartAt && { date: loan2StartAt.getTime() }),
          }),
        });
        if (liability2Res.ok) {
          const liability2Data = (await liability2Res.json()) as { id: string };
          liability2Id = liability2Data.id;
        }
      }

      // 5. Create cash account(s) if needed
      const cashClassId = assetClasses.find((c) =>
        c.name.toLowerCase().includes("cash"),
      )?.id;
      let resolvedCashAssetId = cashAssetId;
      if (fundingSource !== "leveraged" && needsNewCashAccount && currencyId) {
        const newCashRes = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID,
            name: `${selectedCurrencyCode} Cash`,
            currency: currencyId,
            ...(cashClassId && { asset_class: cashClassId }),
            investable: "investable_cash",
          }),
        });
        if (newCashRes.ok) {
          const newCashData = (await newCashRes.json()) as { id: string };
          resolvedCashAssetId = newCashData.id;
        }
      }
      // Remainder own_funds: create cash account if none exists
      let resolvedRemainderCashAssetId = remainderCashAssetId;
      if (hasRemainder && remainderFundingSource === "own_funds" && needsRemainderCashAccount && currencyId) {
        const existingOrNewCashId = resolvedCashAssetId || cashAssetId;
        if (existingOrNewCashId) {
          // Reuse the primary cash account if one was just created or already selected
          resolvedRemainderCashAssetId = existingOrNewCashId;
        } else {
          const newCashRes = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entity: entityUUID,
              name: `${selectedCurrencyCode} Cash`,
              currency: currencyId,
              ...(cashClassId && { asset_class: cashClassId }),
              investable: "investable_cash",
            }),
          });
          if (newCashRes.ok) {
            const newCashData = (await newCashRes.json()) as { id: string };
            resolvedRemainderCashAssetId = newCashData.id;
          }
        }
      }

      // 6. Create initial transaction + entries (if transactional data present)
      // Asset-in always uses the full purchase amount; liability/cash legs use their respective amounts
      const assetTxAmount = Number(purchaseAmount);
      const primaryLoanAmount = Number(loanAmount);
      const txQty = Number(quantity);
      const txRate = Number(indicativeRate);
      const txAmount = fundingSource === "leveraged" ? primaryLoanAmount : assetTxAmount;
      const hasTransaction = isLiveTicker
        ? txQty > 0 || assetTxAmount > 0 || txRate > 0
        : isCashClass
          ? autoRecordCashIn && assetTxAmount > 0
          : assetTxAmount > 0 || txQty > 0;

      const txDate = fundingSource === "leveraged" ? (loanStartAt ?? purchasedAt) : purchasedAt;

      if (hasTransaction && txDate) {
        const txRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            created_by_entity: entityUUID,
            date: txDate.getTime(),
            type: isCashClass ? 1 : 2, // 1 = New money in, 2 = Buy
          }),
        });
        const txData = (await txRes.json()) as { id: string };
        const txId = txData.id;

        const postEntry = (body: Record<string, unknown>) =>
          fetch("/api/transaction-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transaction: txId, entity: entityUUID, ...(currencyId && { currency: currencyId }), ...body }),
          });

        if (fundingSource === "leveraged") {
          // Asset-in: one leg per funding source, each with source + source_id
          if (liabilityId && primaryLoanAmount > 0) {
            await postEntry({
              entry_type: "asset",
              object_type: "asset",
              object_id: assetId,
              direction: "in",
              amount: primaryLoanAmount,
              ...(txQty > 0 && { units: txQty }),
              ...(txRate > 0 && { price_per_unit: txRate }),
              source: "liability",
              source_id: liabilityId,
            });
          }
          if (hasRemainder && loanRemainder > 0) {
            if (remainderFundingSource === "leveraged" && liability2Id) {
              await postEntry({
                entry_type: "asset",
                object_type: "asset",
                object_id: assetId,
                direction: "in",
                amount: loanRemainder,
                source: "liability",
                source_id: liability2Id,
              });
            } else if (remainderFundingSource === "own_funds" && resolvedRemainderCashAssetId) {
              await postEntry({
                entry_type: "asset",
                object_type: "asset",
                object_id: assetId,
                direction: "in",
                amount: loanRemainder,
                source: "cash",
                source_id: resolvedRemainderCashAssetId,
              });
            }
          }
          // Liability-in legs
          if (liabilityId && primaryLoanAmount > 0) {
            await postEntry({
              entry_type: "liability",
              object_type: "liability",
              object_id: liabilityId,
              direction: "in",
              amount: primaryLoanAmount,
            });
          }
          if (hasRemainder && loanRemainder > 0 && remainderFundingSource === "leveraged" && liability2Id) {
            await postEntry({
              entry_type: "liability",
              object_type: "liability",
              object_id: liability2Id,
              direction: "in",
              amount: loanRemainder,
            });
          }
          // Cash legs for remainder funded by own funds
          if (hasRemainder && loanRemainder > 0 && remainderFundingSource === "own_funds" && resolvedRemainderCashAssetId) {
            if (needsRemainderCashAccount || remainderRecordNewMoneyIn) {
              await postEntry({
                entry_type: "cash",
                object_type: "asset",
                object_id: resolvedRemainderCashAssetId,
                direction: "in",
                amount: loanRemainder,
                source: "new_money_in",
              });
            }
            await postEntry({
              entry_type: "cash",
              object_type: "asset",
              object_id: resolvedRemainderCashAssetId,
              direction: "out",
              amount: loanRemainder,
              source: "asset",
              source_id: assetId,
            });
          }
        } else if (!isCashClass && resolvedCashAssetId && txAmount > 0) {
          // Asset-in with cash source
          await postEntry({
            entry_type: "asset",
            object_type: "asset",
            object_id: assetId,
            direction: "in",
            ...(txQty > 0 && { units: txQty }),
            ...(txRate > 0 && { price_per_unit: txRate }),
            amount: txAmount,
            source: "cash",
            source_id: resolvedCashAssetId,
          });
        } else if (isCashClass) {
          // Cash asset-in (new money in for cash class)
          await postEntry({
            entry_type: "cash",
            object_type: "asset",
            object_id: assetId,
            direction: "in",
            ...(txQty > 0 && { units: txQty }),
            ...(txRate > 0 && { price_per_unit: txRate }),
            ...(assetTxAmount > 0 && { amount: assetTxAmount }),
            source: "new_money_in",
          });
        }

        if (!isCashClass && resolvedCashAssetId && txAmount > 0 && fundingSource !== "leveraged") {
          // Cash legs (non-leveraged, non-cash assets only)
          if (needsNewCashAccount || recordNewMoneyIn || needsSplit) {
            await postEntry({
              entry_type: "cash",
              object_type: "asset",
              object_id: resolvedCashAssetId,
              direction: "in",
              amount: needsSplit ? splitAmount : txAmount,
              source: "new_money_in",
            });
          }
          await postEntry({
            entry_type: "cash",
            object_type: "asset",
            object_id: resolvedCashAssetId,
            direction: "out",
            amount: txAmount,
            source: "asset",
            source_id: assetId,
          });
        }
      }

      onCreated();
      notifyLedgerUpdate();
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create asset.");
    } finally {
      setSubmitLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const isLastStep = step === 4;
  const canContinue =
    step === 1
      ? !!source
      : step === 2
        ? canContinueStep2
        : step === 3
          ? canContinueStep3
          : true;

  return (
    <>
      {expandedScheme && schedules && (
        <AmortizationDialog
          scheme={expandedScheme}
          periods={schedules[expandedScheme]}
          open
          onClose={() => setExpandedScheme(null)}
        />
      )}
      {expandedScheme2 && schedules2 && (
        <AmortizationDialog
          scheme={expandedScheme2}
          periods={schedules2[expandedScheme2]}
          open
          onClose={() => setExpandedScheme2(null)}
        />
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add an asset</DialogTitle>
            <DialogDescription>
              Step {displayedStep} of {totalSteps}. We will walk through your
              asset setup.
            </DialogDescription>
          </DialogHeader>

          <div>
            {/* ── Step 1: Source selection ──────────────────────── */}
            {step === 1 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(["live-ticker", "manual"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={`rounded-lg border p-4 text-left transition-colors ${source === s ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                  >
                    <p className="font-semibold">
                      {s === "live-ticker" ? "Live Ticker" : "Manual Entry"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {s === "live-ticker"
                        ? "Select this for assets connected to a live pricing feed."
                        : "Enter a custom asset with manually tracked values."}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* ── Step 2 (live-ticker): Ticker + price ─────────── */}
            {step === 2 && isLiveTicker && (
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel htmlFor="ticker-search">Ticker</FieldLabel>
                  <Input
                    id="ticker-search"
                    value={tickerQuery}
                    onChange={(e) => setTickerQuery(e.target.value)}
                    placeholder="Search symbol or company (e.g. AAPL, Tesla)"
                  />
                  {tickerLoading && (
                    <FieldDescription>Searching symbols…</FieldDescription>
                  )}
                  {!tickerLoading && tickerResults.length > 0 && (
                    <div className="max-h-48 overflow-auto rounded-md border">
                      {tickerResults.map((r) => (
                        <button
                          key={`${r.ticker}-${r.exchange}`}
                          type="button"
                          onClick={() => selectTicker(r)}
                          className="hover:bg-muted w-full border-b px-3 py-2 text-left text-sm last:border-b-0"
                        >
                          <p className="font-medium">{r.ticker}</p>
                          <p className="text-muted-foreground text-xs">
                            {r.name}
                            {r.currency ? ` • ${r.currency}` : ""}
                            {r.type ? ` • ${r.ticker.toUpperCase().endsWith(".CC") ? "Cryptocurrency" : r.type}` : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {!tickerLoading &&
                    tickerQuery.trim().length >= 2 &&
                    tickerResults.length === 0 && (
                      <FieldDescription>No tickers found.</FieldDescription>
                    )}
                </Field>

                {selectedTicker && (
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{selectedTicker.ticker}</p>
                    <p className="text-muted-foreground text-xs">
                      {selectedTicker.name}
                      {selectedTicker.currency
                        ? ` • ${selectedTicker.currency}`
                        : ""}
                      {selectedTicker.type ? ` • ${selectedTicker.ticker.toUpperCase().endsWith(".CC") ? "Cryptocurrency" : selectedTicker.type}` : ""}
                    </p>
                  </div>
                )}

                {selectedTicker && (
                  <>
                    <DateTimePickerInput
                      id="ticker-date"
                      label="Purchase date & time"
                      value={purchasedAt}
                      onChange={setPurchasedAt}
                    />
                    {autoPriceLoading && (
                      <FieldDescription>
                        Looking up historical price…
                      </FieldDescription>
                    )}
                    {!autoPriceLoading && autoPriceSource && (
                      <FieldDescription>
                        Rate auto-filled from {autoPriceSource} price.
                      </FieldDescription>
                    )}
                    {autoPriceError && (
                      <FieldError>{autoPriceError}</FieldError>
                    )}
                    <div className="grid grid-cols-3 gap-4">
                      <Field>
                        <FieldLabel htmlFor="ticker-qty">Quantity</FieldLabel>
                        <Input
                          id="ticker-qty"
                          type="number"
                          step="any"
                          min="0"
                          value={quantity}
                          onChange={handleQuantityChange}
                          placeholder="1"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="ticker-amount">
                          How much did you pay?
                        </FieldLabel>
                        <Input
                          id="ticker-amount"
                          type="number"
                          step="any"
                          min="0"
                          value={purchaseAmount}
                          onChange={handlePurchaseAmountChange}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="ticker-rate">
                          Indicative rate{" "}
                          {Number(quantity) > 1 ? "(if qty > 1)" : ""}
                        </FieldLabel>
                        <Input
                          id="ticker-rate"
                          type="number"
                          step="any"
                          min="0"
                          value={indicativeRate}
                          onChange={handleIndicativeRateChange}
                          placeholder="0.00"
                        />
                      </Field>
                    </div>
                  </>
                )}
              </FieldGroup>
            )}

            {/* ── Step 2 (manual): Asset details ───────────────── */}
            {step === 2 && !isLiveTicker && (
              <FieldGroup className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Asset class</FieldLabel>
                    <Select
                      value={assetClassId?.toString() ?? ""}
                      onValueChange={(v) => setAssetClassId(Number(v))}
                      disabled={
                        loadingOptions || visibleAssetClasses.length === 0
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select class…" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleAssetClasses.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="asset-name">Name</FieldLabel>
                    <Input
                      id="asset-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter asset name"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="asset-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="asset-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="min-h-20 resize-none"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Country</FieldLabel>
                    <Select
                      value={countryId?.toString() ?? ""}
                      onValueChange={(v) => setCountryId(Number(v))}
                      disabled={loadingOptions || countries.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select country…" />
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
                    <FieldLabel>Currency</FieldLabel>
                    <Select
                      value={currencyId?.toString() ?? ""}
                      onValueChange={(v) => setCurrencyId(Number(v))}
                      disabled={currencies.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select currency…" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.code} — {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {isCashClass ? (
                  <div className="rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Automatically record new money in
                        </p>
                        <p className="text-xs text-muted-foreground">
                          If off, creates the cash asset without any
                          transaction.
                        </p>
                      </div>
                      <Switch
                        checked={autoRecordCashIn}
                        onCheckedChange={setAutoRecordCashIn}
                      />
                    </div>
                    {autoRecordCashIn && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <Field>
                          <FieldLabel htmlFor="cash-amount">
                            New money in
                          </FieldLabel>
                          <Input
                            id="cash-amount"
                            type="number"
                            step="any"
                            min="0"
                            value={purchaseAmount}
                            onChange={(e) => setPurchaseAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </Field>
                        <DatePickerInput
                          id="cash-date"
                          label="Date"
                          value={purchasedAt}
                          onChange={setPurchasedAt}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <DatePickerInput
                    id="asset-date"
                    label="Acquisition date"
                    value={purchasedAt}
                    onChange={setPurchasedAt}
                  />
                )}
              </FieldGroup>
            )}

            {/* ── Step 3 (live-ticker): Asset metadata ──────────── */}
            {step === 3 && isLiveTicker && (
              <FieldGroup className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Asset class</FieldLabel>
                    <Select
                      value={assetClassId?.toString() ?? ""}
                      onValueChange={(v) => setAssetClassId(Number(v))}
                      disabled={!!selectedTicker?.ticker.toUpperCase().endsWith(".CC")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select class…" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleAssetClasses.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lt-name">Name</FieldLabel>
                    <Input
                      id="lt-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter asset name"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="lt-description">Description</FieldLabel>
                  <Textarea
                    id="lt-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="min-h-20 resize-none"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Country</FieldLabel>
                    <Select
                      value={countryId?.toString() ?? ""}
                      onValueChange={(v) => setCountryId(Number(v))}
                      disabled={tickerLockedCountry}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select country…" />
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
                    <FieldLabel>Currency</FieldLabel>
                    <Select
                      value={currencyId?.toString() ?? ""}
                      onValueChange={(v) => {
                        setCurrencyId(Number(v));
                        setCashAssetId("");
                        setCreateNewCashAccount(false);
                      }}
                      disabled={tickerLockedCurrency}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select currency…" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.code} — {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-3">
                  <p className="text-sm font-medium">How was this funded?</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      {
                        value: "own_funds" as const,
                        label: "Own funds",
                        desc: "Funded from the entity's own capital or new money in.",
                      },
                      {
                        value: "leveraged" as const,
                        label: "Leveraged (loan)",
                        desc: "Part or all of the purchase was financed through debt.",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setFundingSource(opt.value);
                          if (opt.value !== "own_funds") setCashAssetId("");
                        }}
                        className={`rounded-lg border p-4 text-left transition-colors ${fundingSource === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                      >
                        <p className="font-semibold text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {fundingSource === "own_funds" && (
                  <>
                    {showNewCashAccountNotice ? (
                      requiresCapitalCheck ? (
                        <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm">
                          <p className="font-medium text-red-800 dark:text-red-300">
                            No {selectedCurrencyCode} cash account — capital required
                          </p>
                          <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">
                            Add shareholders via the Cap table first to inject capital into this company before investing.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
                          <p className="font-medium text-amber-800 dark:text-amber-300">
                            No {selectedCurrencyCode} cash account found
                          </p>
                          <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                            A new {selectedCurrencyCode} cash account will be created automatically and the purchase amount will be recorded as new money in.
                          </p>
                        </div>
                      )
                    ) : (
                      <Field>
                        <FieldLabel>Cash / bank account</FieldLabel>
                        <FieldDescription>
                          Which cash asset do the funds flow through?
                        </FieldDescription>
                        <Select value={cashAssetId} onValueChange={setCashAssetId}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a cash account…" />
                          </SelectTrigger>
                          <SelectContent>
                            {(currencyMatchedCashAssets.length > 0
                              ? currencyMatchedCashAssets
                              : cashAssets
                            ).map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name ?? "Unnamed"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}

                    {insufficientCashBalance && (
                      <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm">
                        <p className="font-medium text-red-800 dark:text-red-300">
                          Insufficient capital
                        </p>
                        <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">
                          Cash balance ({selectedCurrencyCode} {selectedCashBalance.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than the purchase amount. Add shareholders via the Cap table to inject more capital first.
                        </p>
                      </div>
                    )}

                    {cashAssetId && !needsNewCashAccount && allowNewMoneyIn && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="grid gap-0.5">
                          <p className="text-sm font-medium">
                            {recordNewMoneyIn
                              ? "Record new money in"
                              : "Deplete current cash balance"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {recordNewMoneyIn
                              ? "Adds a money-in entry to the cash account before the purchase."
                              : "Uses the existing cash balance — no new money-in entry recorded."}
                          </p>
                        </div>
                        <Switch
                          checked={recordNewMoneyIn}
                          onCheckedChange={setRecordNewMoneyIn}
                        />
                      </div>
                    )}

                    {needsSplit && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-300">Split funding</p>
                        <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                          Cash balance ({selectedCurrencyCode} {selectedCashBalance.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than the purchase amount.{" "}
                          {selectedCurrencyCode} {splitAmount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be recorded as new money in to cover the shortfall.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {fundingSource === "leveraged" && (
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="lt-loan-name">Loan name</FieldLabel>
                        <Input
                          id="lt-loan-name"
                          value={loanName}
                          onChange={(e) => setLoanName(e.target.value)}
                          placeholder="e.g. Margin loan"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="lt-loan-ref">Reference (optional)</FieldLabel>
                        <Input
                          id="lt-loan-ref"
                          value={loanReference}
                          onChange={(e) => setLoanReference(e.target.value)}
                          placeholder="e.g. REF-123"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <Field>
                        <FieldLabel htmlFor="lt-loan-amount">Loan amount</FieldLabel>
                        <Input
                          id="lt-loan-amount"
                          type="number"
                          step="any"
                          min="0"
                          value={loanAmount}
                          onChange={(e) => setLoanAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="lt-loan-rate">Interest rate (%)</FieldLabel>
                        <Input
                          id="lt-loan-rate"
                          type="number"
                          step="any"
                          min="0"
                          value={interestRate}
                          onChange={(e) => setInterestRate(e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Frequency</FieldLabel>
                        <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="bi-annually">Bi-annually</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="lt-loan-term">Term ({termUnitLabel(frequency)})</FieldLabel>
                        <Input
                          id="lt-loan-term"
                          type="number"
                          min="1"
                          step="1"
                          value={termLength}
                          onChange={(e) => setTermLength(e.target.value)}
                          placeholder="e.g. 25"
                        />
                      </Field>
                    </div>
                    <DatePickerInput
                      id="lt-loan-start"
                      label="Loan start date"
                      value={loanStartAt}
                      onChange={setLoanStartAt}
                    />
                    {schedules && (
                      <div className="grid gap-3">
                        <p className="text-sm font-medium">Repayment scheme</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          {(["linear", "bullet", "annuity"] as PaymentScheme[]).map((s) => (
                            <SchemeCard
                              key={s}
                              scheme={s}
                              periods={schedules[s]}
                              selected={selectedScheme === s}
                              onSelect={() => setSelectedScheme(s)}
                              onExpand={() => setExpandedScheme(s)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </FieldGroup>
                )}
              </FieldGroup>
            )}

            {/* ── Step 3 (manual, non-cash): Initial transaction + Funding ── */}
            {step === 3 && !isLiveTicker && (
              <FieldGroup className="mt-4">
                <div>
                  <p className="text-sm font-medium mb-3">Initial purchase (optional)</p>
                  <div className="grid grid-cols-3 gap-4">
                    <Field>
                      <FieldLabel htmlFor="asset-qty">Quantity</FieldLabel>
                      <Input
                        id="asset-qty"
                        type="number"
                        step="any"
                        min="0"
                        value={quantity}
                        onChange={handleQuantityChange}
                        placeholder="1"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="asset-rate">Price per unit</FieldLabel>
                      <Input
                        id="asset-rate"
                        type="number"
                        step="any"
                        min="0"
                        value={indicativeRate}
                        onChange={handleIndicativeRateChange}
                        placeholder="0.00"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="asset-paid">Total amount</FieldLabel>
                      <Input
                        id="asset-paid"
                        type="number"
                        step="any"
                        min="0"
                        value={purchaseAmount}
                        onChange={handlePurchaseAmountChange}
                        placeholder="0.00"
                      />
                    </Field>
                  </div>
                </div>

                <div className="grid gap-3">
                  <p className="text-sm font-medium">How was this asset funded?</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      {
                        value: "own_funds" as const,
                        label: "Own funds",
                        desc: "Funded from the entity's own capital or new money in.",
                      },
                      {
                        value: "leveraged" as const,
                        label: "Leveraged (loan)",
                        desc: "Part or all of the purchase was financed through debt.",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setFundingSource(opt.value);
                          if (opt.value === "leveraged") {
                            setCashAssetId("");
                            // Default loan amount to the full purchase amount
                            if (!loanAmount && purchaseAmount) setLoanAmount(purchaseAmount);
                          }
                        }}
                        className={`rounded-lg border p-4 text-left transition-colors ${fundingSource === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                      >
                        <p className="font-semibold text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {fundingSource === "own_funds" && (
                  <>
                    {showNewCashAccountNotice ? (
                      requiresCapitalCheck ? (
                        <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm">
                          <p className="font-medium text-red-800 dark:text-red-300">
                            No {selectedCurrencyCode} cash account — capital required
                          </p>
                          <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">
                            Add shareholders via the Cap table first to inject capital into this company before investing.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
                          <p className="font-medium text-amber-800 dark:text-amber-300">
                            No {selectedCurrencyCode} cash account found
                          </p>
                          <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                            A new {selectedCurrencyCode} cash account will be created automatically and the purchase amount will be recorded as new money in.
                          </p>
                        </div>
                      )
                    ) : (
                      <Field>
                        <FieldLabel>Cash / bank account</FieldLabel>
                        <FieldDescription>
                          Which cash asset do the funds flow through?
                        </FieldDescription>
                        <Select value={cashAssetId} onValueChange={setCashAssetId}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a cash account…" />
                          </SelectTrigger>
                          <SelectContent>
                            {(currencyMatchedCashAssets.length > 0
                              ? currencyMatchedCashAssets
                              : cashAssets
                            ).map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name ?? "Unnamed"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}

                    {insufficientCashBalance && (
                      <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm">
                        <p className="font-medium text-red-800 dark:text-red-300">
                          Insufficient capital
                        </p>
                        <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">
                          Cash balance ({selectedCurrencyCode} {selectedCashBalance.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than the purchase amount. Add shareholders via the Cap table to inject more capital first.
                        </p>
                      </div>
                    )}

                    {cashAssetId && !needsNewCashAccount && allowNewMoneyIn && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="grid gap-0.5">
                          <p className="text-sm font-medium">
                            {recordNewMoneyIn
                              ? "Record new money in"
                              : "Deplete current cash balance"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {recordNewMoneyIn
                              ? "Adds a money-in entry to the cash account before the purchase."
                              : "Uses the existing cash balance — no new money-in entry recorded."}
                          </p>
                        </div>
                        <Switch
                          checked={recordNewMoneyIn}
                          onCheckedChange={setRecordNewMoneyIn}
                        />
                      </div>
                    )}

                    {needsSplit && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-300">Split funding</p>
                        <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                          Cash balance ({selectedCurrencyCode} {selectedCashBalance.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than the purchase amount.{" "}
                          {selectedCurrencyCode} {splitAmount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be recorded as new money in to cover the shortfall.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {fundingSource === "leveraged" && (
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="loan-name">Loan name</FieldLabel>
                        <Input
                          id="loan-name"
                          value={loanName}
                          onChange={(e) => setLoanName(e.target.value)}
                          placeholder="e.g. Mortgage BNP"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="loan-ref">
                          Reference (optional)
                        </FieldLabel>
                        <Input
                          id="loan-ref"
                          value={loanReference}
                          onChange={(e) => setLoanReference(e.target.value)}
                          placeholder="e.g. REF-123"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <Field>
                        <FieldLabel htmlFor="loan-amount">
                          Loan amount
                        </FieldLabel>
                        <Input
                          id="loan-amount"
                          type="number"
                          step="any"
                          min="0"
                          value={loanAmount}
                          onChange={(e) => setLoanAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="loan-rate">
                          Interest rate (%)
                        </FieldLabel>
                        <Input
                          id="loan-rate"
                          type="number"
                          step="any"
                          min="0"
                          value={interestRate}
                          onChange={(e) => setInterestRate(e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Frequency</FieldLabel>
                        <Select
                          value={frequency}
                          onValueChange={(v) => setFrequency(v as Frequency)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="bi-annually">Bi-annually</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="loan-term">
                          Term ({termUnitLabel(frequency)})
                        </FieldLabel>
                        <Input
                          id="loan-term"
                          type="number"
                          min="1"
                          step="1"
                          value={termLength}
                          onChange={(e) => setTermLength(e.target.value)}
                          placeholder="e.g. 25"
                        />
                      </Field>
                    </div>
                    <DatePickerInput
                      id="loan-start"
                      label="Loan start date"
                      value={loanStartAt}
                      onChange={setLoanStartAt}
                    />
                    {schedules && (
                      <div className="grid gap-3">
                        <p className="text-sm font-medium">Repayment scheme</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          {(
                            ["linear", "bullet", "annuity"] as PaymentScheme[]
                          ).map((s) => (
                            <SchemeCard
                              key={s}
                              scheme={s}
                              periods={schedules[s]}
                              selected={selectedScheme === s}
                              onSelect={() => setSelectedScheme(s)}
                              onExpand={() => setExpandedScheme(s)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Remainder funding when purchaseAmount > loanAmount */}
                    {hasRemainder && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 grid gap-3">
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                            Remaining {fmtNum(loanRemainder)} {selectedCurrencyCode} to fund
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            The loan covers {fmtNum(Number(loanAmount))} but the purchase total is {fmtNum(Number(purchaseAmount))}. How will you fund the difference?
                          </p>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {([
                            { value: "own_funds" as const, label: "Own funds / cash", desc: "Use an existing cash account or record new money in." },
                            { value: "leveraged" as const, label: "Another loan", desc: "Take an additional loan to cover the remainder." },
                          ]).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRemainderFundingSource(opt.value)}
                              className={`rounded-lg border p-3 text-left transition-colors ${remainderFundingSource === opt.value ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/50"}`}
                            >
                              <p className="font-semibold text-sm">{opt.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                            </button>
                          ))}
                        </div>

                        {remainderFundingSource === "own_funds" && (
                          <div className="grid gap-3">
                            {needsRemainderCashAccount ? (
                              <p className="text-xs text-amber-700 dark:text-amber-400">
                                A new {selectedCurrencyCode} cash account will be created and the remainder will be recorded as new money in.
                              </p>
                            ) : (
                              <Field>
                                <FieldLabel>Cash / bank account</FieldLabel>
                                <Select value={remainderCashAssetId} onValueChange={setRemainderCashAssetId}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a cash account…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(currencyMatchedCashAssets.length > 0
                                      ? currencyMatchedCashAssets
                                      : cashAssets
                                    ).map((a) => (
                                      <SelectItem key={a.id} value={a.id}>
                                        {a.name ?? "Unnamed"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}
                            {remainderCashAssetId && !needsRemainderCashAccount && allowNewMoneyIn && (
                              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                                <div className="grid gap-0.5">
                                  <p className="text-sm font-medium">
                                    {remainderRecordNewMoneyIn ? "Record new money in" : "Deplete current cash balance"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {remainderRecordNewMoneyIn
                                      ? "Adds a money-in entry to the cash account before the purchase."
                                      : "Uses the existing cash balance — no new money-in entry recorded."}
                                  </p>
                                </div>
                                <Switch checked={remainderRecordNewMoneyIn} onCheckedChange={setRemainderRecordNewMoneyIn} />
                              </div>
                            )}
                          </div>
                        )}

                        {remainderFundingSource === "leveraged" && (
                          <FieldGroup>
                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <FieldLabel htmlFor="loan2-name">Loan name</FieldLabel>
                                <Input
                                  id="loan2-name"
                                  value={loan2Name}
                                  onChange={(e) => setLoan2Name(e.target.value)}
                                  placeholder="e.g. Bridging loan"
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor="loan2-ref">Reference (optional)</FieldLabel>
                                <Input
                                  id="loan2-ref"
                                  value={loan2Reference}
                                  onChange={(e) => setLoan2Reference(e.target.value)}
                                  placeholder="e.g. REF-456"
                                />
                              </Field>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                              <Field>
                                <FieldLabel htmlFor="loan2-amount">Loan amount</FieldLabel>
                                <Input
                                  id="loan2-amount"
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={loan2Amount}
                                  onChange={(e) => setLoan2Amount(e.target.value)}
                                  placeholder="0.00"
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor="loan2-rate">Interest rate (%)</FieldLabel>
                                <Input
                                  id="loan2-rate"
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={loan2InterestRate}
                                  onChange={(e) => setLoan2InterestRate(e.target.value)}
                                  placeholder="0.00"
                                />
                              </Field>
                              <Field>
                                <FieldLabel>Frequency</FieldLabel>
                                <Select value={loan2Frequency} onValueChange={(v) => setLoan2Frequency(v as Frequency)}>
                                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="bi-annually">Bi-annually</SelectItem>
                                    <SelectItem value="annually">Annually</SelectItem>
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field>
                                <FieldLabel htmlFor="loan2-term">Term ({termUnitLabel(loan2Frequency)})</FieldLabel>
                                <Input
                                  id="loan2-term"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={loan2TermLength}
                                  onChange={(e) => setLoan2TermLength(e.target.value)}
                                  placeholder="e.g. 10"
                                />
                              </Field>
                            </div>
                            <DatePickerInput
                              id="loan2-start"
                              label="Loan start date"
                              value={loan2StartAt}
                              onChange={setLoan2StartAt}
                            />
                            {schedules2 && (
                              <div className="grid gap-3">
                                <p className="text-sm font-medium">Repayment scheme</p>
                                <div className="grid gap-3 md:grid-cols-3">
                                  {(["linear", "bullet", "annuity"] as PaymentScheme[]).map((s) => (
                                    <SchemeCard
                                      key={s}
                                      scheme={s}
                                      periods={schedules2[s]}
                                      selected={loan2Scheme === s}
                                      onSelect={() => setLoan2Scheme(s)}
                                      onExpand={() => setExpandedScheme2(s)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </FieldGroup>
                        )}
                      </div>
                    )}
                  </FieldGroup>
                )}
              </FieldGroup>
            )}

            {/* ── Step 4: Document upload ───────────────────────── */}
            {step === 4 && (
              <div className="mt-4 grid gap-4">
                <div
                  className="rounded-lg border-2 border-dashed p-12 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dt = e.dataTransfer.files;
                    if (dt) setFiles((prev) => [...prev, ...Array.from(dt)]);
                  }}
                >
                  <Upload className="mx-auto size-8 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">
                    Drag and drop files here, or click to upload
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add supporting documents for this asset.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files)
                      setFiles((prev) => [
                        ...prev,
                        ...Array.from(e.target.files!),
                      ]);
                  }}
                />
                {files.length > 0 && (
                  <ul className="grid gap-1">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive ml-3 shrink-0"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {error && <FieldError className="px-1">{error}</FieldError>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (step === 1) {
                  setOpen(false);
                  reset();
                } else handleBack();
              }}
            >
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            {isLastStep ? (
              <Button onClick={save} disabled={submitLoading}>
                {submitLoading ? <Spinner /> : "Save asset"}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canContinue}>
                Continue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
