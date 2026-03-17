"use client";

import * as React from "react";
import { Plus, Search, X, Check, ChevronsUpDown, Loader2, AlertCircle } from "lucide-react";
import { getCountries, getCountryCallingCode } from "react-phone-number-input";
import { getExampleNumber } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
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
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Country / phone data ──────────────────────────────────────────────────────

function flagEmoji(code: string) {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

function getCountryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const COUNTRIES = getCountries()
  .map((code) => ({
    code,
    calling: `+${getCountryCallingCode(code)}`,
    name: getCountryName(code),
    flag: flagEmoji(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ── Google Maps JS SDK minimal types ─────────────────────────────────────────

type GMAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};
type GMPrediction = {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
};

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              req: { input: string; types?: string[]; sessionToken?: unknown },
              cb: (results: GMPrediction[] | null, status: string) => void,
            ) => void;
          };
          PlacesService: new (el: HTMLElement) => {
            getDetails: (
              req: {
                placeId: string;
                fields: string[];
                sessionToken?: unknown;
              },
              cb: (
                result: { address_components?: GMAddressComponent[] } | null,
                status: string,
              ) => void,
            ) => void;
          };
          AutocompleteSessionToken: new () => unknown;
          PlacesServiceStatus: { OK: string };
        };
      };
    };
  }
}

type AddressFields = {
  street: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  zip: string;
  countryRegion: string;
};

// ── Phone input component ─────────────────────────────────────────────────────

function PhoneNumberInput({
  value,
  onChange,
  defaultCountry = "GB",
}: {
  value: string;
  onChange: (val: string) => void;
  defaultCountry?: string;
}) {
  const [countryCode, setCountryCode] = React.useState(defaultCountry);

  const placeholder = React.useMemo(() => {
    try {
      const ex = getExampleNumber(
        countryCode as Parameters<typeof getExampleNumber>[0],
        examples,
      );
      return ex?.formatNational() ?? "312 345 6789";
    } catch {
      return "312 345 6789";
    }
  }, [countryCode]);
  const [open, setOpen] = React.useState(false);
  const selected =
    COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];

  function handleCountrySelect(code: string) {
    setCountryCode(code);
    setOpen(false);
    // Update the stored value to reflect new dial code if there's a number
    if (value) {
      const local = value.replace(/^\+\d+\s*/, "");
      const newDialCode = `+${getCountryCallingCode(code as ReturnType<typeof getCountries>[number])}`;
      onChange(`${newDialCode} ${local}`);
    }
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const local = e.target.value;
    if (!local) {
      onChange("");
      return;
    }
    onChange(`${selected.calling} ${local}`);
  }

  const localNumber = value.startsWith(selected.calling)
    ? value.slice(selected.calling.length).trimStart()
    : value.replace(/^\+\d+\s*/, "");

  return (
    <div className="flex gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-32 shrink-0 justify-between font-normal"
          >
            <span>
              {selected.flag} {selected.calling}
            </span>
            <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command className="overflow-visible">
            <CommandInput placeholder="Search country..." />
            <CommandList
              className="max-h-60 overflow-y-scroll"
              onWheel={(e) => e.stopPropagation()}
            >
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.code} ${c.calling}`}
                    onSelect={() => handleCountrySelect(c.code)}
                  >
                    <span className="w-6">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {c.calling}
                    </span>
                    {countryCode === c.code && (
                      <Check className="size-3.5 ml-1 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        placeholder={placeholder}
        value={localNumber}
        onChange={handleNumberChange}
        className="flex-1"
      />
    </div>
  );
}

// ── Address search component ──────────────────────────────────────────────────

function AddressSearch({
  onSelect,
}: {
  onSelect: (fields: AddressFields) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [predictions, setPredictions] = React.useState<GMPrediction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = React.useRef<unknown>(null);
  const mapDivRef = React.useRef<HTMLDivElement>(null);

  function getSessionToken() {
    if (!window.google) return undefined;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current =
        new window.google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length < 2 || !window.google) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setLoading(true);
      const svc = new window.google!.maps.places.AutocompleteService();
      svc.getPlacePredictions(
        { input: val, types: ["address"], sessionToken: getSessionToken() },
        (results, status) => {
          setLoading(false);
          if (
            status === window.google!.maps.places.PlacesServiceStatus.OK &&
            results
          ) {
            setPredictions(results);
            setOpen(results.length > 0);
          } else {
            setPredictions([]);
            setOpen(false);
          }
        },
      );
    }, 350);
  }

  function handleSelect(p: GMPrediction) {
    setQuery(p.structured_formatting.main_text);
    setOpen(false);
    setPredictions([]);
    if (!window.google || !mapDivRef.current) return;
    const svc = new window.google.maps.places.PlacesService(mapDivRef.current);
    const token = sessionTokenRef.current;
    sessionTokenRef.current = null;
    svc.getDetails(
      {
        placeId: p.place_id,
        fields: ["address_components"],
        sessionToken: token ?? undefined,
      },
      (result, status) => {
        if (
          status !== window.google!.maps.places.PlacesServiceStatus.OK ||
          !result?.address_components
        )
          return;
        const c = result.address_components;
        function pick(type: string) {
          return c!.find((x) => x.types.includes(type))?.long_name ?? "";
        }
        onSelect({
          street: [pick("street_number"), pick("route")]
            .filter(Boolean)
            .join(" "),
          addressLine2: pick("sublocality_level_1"),
          city: pick("locality") || pick("postal_town"),
          stateProvince: pick("administrative_area_level_1"),
          zip: pick("postal_code"),
          countryRegion: pick("country"),
        });
      },
    );
  }

  return (
    <div className="relative">
      <div ref={mapDivRef} className="hidden" aria-hidden />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search address..."
          value={query}
          onChange={handleChange}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        )}
      </div>
      {open && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted"
              onMouseDown={() => handleSelect(p)}
            >
              <span className="font-medium">
                {p.structured_formatting.main_text}
              </span>
              <span className="text-muted-foreground ml-1.5 text-xs">
                {p.structured_formatting.secondary_text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

type Fund = { id: string; name?: string | null; entity?: string | null };
type ShareClass = { id: string; name?: string | null };
type IrMember = {
  id: string;
  user: number;
  department?: string | null;
  _user?: { id: number; name: string; email: string } | null;
};

export function AddInvestorDialog({
  assetManagerId,
  entityId,
  funds,
  defaultPhoneCountry,
  onCreated,
  trigger,
}: {
  assetManagerId: string;
  entityId: string;
  funds: Fund[];
  defaultPhoneCountry?: string;
  onCreated?: (lead: Record<string, unknown>) => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(1);

  // Step 1: personal details
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [street, setStreet] = React.useState("");
  const [addressLine2, setAddressLine2] = React.useState("");
  const [city, setCity] = React.useState("");
  const [countryRegion, setCountryRegion] = React.useState("");
  const [stateProvince, setStateProvince] = React.useState("");
  const [zip, setZip] = React.useState("");

  // Step 2: entities
  const [selectedFunds, setSelectedFunds] = React.useState<string[]>([]);

  // Step 3: amounts + share classes
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [shareClasses, setShareClasses] = React.useState<Record<string, string>>({});
  const [shareClassCache, setShareClassCache] = React.useState<Record<string, ShareClass[]>>({});

  // Step 4: referrer
  const [referrer, setReferrer] = React.useState("");

  // Step 5: IR managers + notes + documents
  const [irSearch, setIrSearch] = React.useState("");
  const [irMembers, setIrMembers] = React.useState<IrMember[]>([]);
  const [selectedIr, setSelectedIr] = React.useState<IrMember[]>([]);
  const [notes, setNotes] = React.useState("");
  const [documents, setDocuments] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedLeadId, setSavedLeadId] = React.useState<string | null>(null);
  const [uploadStatuses, setUploadStatuses] = React.useState<Record<string, "uploading" | "done" | "error">>({});

  React.useEffect(() => {
    if (!open || step !== 3) return;
    for (const id of selectedFunds) {
      const fund = funds.find((f) => f.id === id);
      if (!fund?.entity || shareClassCache[fund.entity] !== undefined) continue;
      fetch(`/api/share-classes?entity=${fund.entity}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: ShareClass[]) =>
          setShareClassCache((prev) => ({ ...prev, [fund.entity!]: data })),
        )
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  React.useEffect(() => {
    if (!open || step !== 5) return;
    fetch(`/api/entity-members?entity=${entityId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setIrMembers(
          Array.isArray(data)
            ? data.filter(
                (m: IrMember) => m.department === "investor_relations",
              )
            : [],
        ),
      )
      .catch(() => {});
  }, [open, step, entityId]);

  function reset() {
    setStep(1);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setStreet("");
    setAddressLine2("");
    setCity("");
    setCountryRegion("");
    setStateProvince("");
    setZip("");
    setSelectedFunds([]);
    setAmounts({});
    setShareClasses({});
    setShareClassCache({});
    setReferrer("");
    setIrSearch("");
    setIrMembers([]);
    setSelectedIr([]);
    setNotes("");
    setDocuments([]);
    setError(null);
    setSavedLeadId(null);
    setUploadStatuses({});
  }

  const canContinue =
    step === 1
      ? !!(firstName.trim() && lastName.trim() && email.trim() && phone.trim())
      : true;

  const isLastStep = step === TOTAL_STEPS;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Build address JSON
      const addressObj = {
        street: street.trim() || undefined,
        line2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: stateProvince.trim() || undefined,
        zip: zip.trim() || undefined,
        country: countryRegion.trim() || undefined,
      };
      const hasAddress = Object.values(addressObj).some(Boolean);

      // Notes: only user-entered notes now — address/interests/amounts go to dedicated fields
      const notesParts: string[] = [];
      const amtEntries = selectedFunds
        .filter((id) => amounts[id])
        .map(
          (id) =>
            `${funds.find((f) => f.id === id)?.name ?? id}: ${amounts[id]}`,
        );
      if (amtEntries.length)
        notesParts.push(`Indicative amounts — ${amtEntries.join(", ")}`);
      if (notes.trim()) notesParts.push(notes.trim());

      const body: Record<string, unknown> = {
        asset_manager: assetManagerId,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        referrer_email: referrer.trim() || undefined,
        notes: notesParts.join("\n") || undefined,
        status: "lead",
      };
      if (hasAddress) body.address = addressObj;
      if (selectedFunds.length > 0) {
        body.interests = selectedFunds.map((id) => ({
          fund: id,
          ...(shareClasses[id] ? { share_class: shareClasses[id] } : {}),
          ...(amounts[id] ? { committed_amount: parseFloat(amounts[id]) } : {}),
        }));
      }
      if (selectedIr.length > 0) body.assigned_to = selectedIr.map((m) => m.id);

      const res = await fetch("/api/investor-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save lead.");
        return;
      }
      const leadId = (data as { id?: string }).id ?? null;
      setSavedLeadId(leadId);
      onCreated?.(data as Record<string, unknown>);

      if (documents.length > 0 && leadId) {
        await uploadFiles(leadId, documents);
      } else {
        setOpen(false);
        reset();
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(leadId: string, files: File[]) {
    const statuses: Record<string, "uploading" | "done" | "error"> = {
      ...uploadStatuses,
    };
    for (const f of files) statuses[f.name] = "uploading";
    setUploadStatuses({ ...statuses });

    const fd = new FormData();
    fd.append("entity", entityId);
    for (const f of files) fd.append("files", f);

    try {
      const res = await fetch(`/api/investor-leads/${leadId}/documents`, {
        method: "POST",
        body: fd,
      });
      for (const f of files) statuses[f.name] = res.ok ? "done" : "error";
    } catch {
      for (const f of files) statuses[f.name] = "error";
    }
    setUploadStatuses({ ...statuses });

    const anyFailed = Object.values(statuses).some((s) => s === "error");
    if (!anyFailed) {
      setOpen(false);
      reset();
    }
    // If failed: dialog stays open showing per-file status + retry/done options
  }

  async function retryUploads() {
    if (!savedLeadId) return;
    const failed = documents.filter((f) => uploadStatuses[f.name] === "error");
    await uploadFiles(savedLeadId, failed);
  }

  const hasUploadErrors = Object.values(uploadStatuses).some((s) => s === "error");
  const isUploading = Object.values(uploadStatuses).some((s) => s === "uploading");

  const filteredIr = irMembers.filter(
    (m) =>
      !selectedIr.find((s) => s.id === m.id) &&
      (!irSearch ||
        m._user?.name?.toLowerCase().includes(irSearch.toLowerCase()) ||
        m._user?.email?.toLowerCase().includes(irSearch.toLowerCase())),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Add investor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add investor lead</DialogTitle>
          <DialogDescription>
            Step {step} of {TOTAL_STEPS}. We will walk through the lead details.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {/* ── Step 1: Personal details ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <FieldGroup className="grid grid-cols-2 gap-2">
                <Field className="flex-1">
                  <FieldLabel htmlFor="inv-first">First name</FieldLabel>
                  <Input
                    id="inv-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoFocus
                  />
                </Field>
                <Field className="flex-1">
                  <FieldLabel htmlFor="inv-last">Last name</FieldLabel>
                  <Input
                    id="inv-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
              </FieldGroup>
              <FieldGroup className="grid grid-cols-2 gap-2">
                <Field className="flex-1">
                  <FieldLabel htmlFor="inv-email">Email address</FieldLabel>
                  <Input
                    id="inv-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field className="flex-1">
                  <FieldLabel>Phone number</FieldLabel>
                  <PhoneNumberInput
                    value={phone}
                    onChange={setPhone}
                    defaultCountry={defaultPhoneCountry}
                  />
                </Field>
              </FieldGroup>
              <Field>
                <FieldLabel>Address</FieldLabel>
                <div className="flex flex-col gap-2">
                  <AddressSearch
                    onSelect={(fields) => {
                      setStreet(fields.street);
                      setAddressLine2(fields.addressLine2);
                      setCity(fields.city);
                      setStateProvince(fields.stateProvince);
                      setZip(fields.zip);
                      setCountryRegion(fields.countryRegion);
                    }}
                  />
                  <Input
                    placeholder="Street address"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                  <FieldGroup className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Apartment, suite, complex"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                    />
                    <Input
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Country/Region"
                      value={countryRegion}
                      onChange={(e) => setCountryRegion(e.target.value)}
                    />
                    <Input
                      placeholder="State/County/Province"
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                    />
                    <Input
                      placeholder="Zip/Postal code"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                    />
                  </FieldGroup>
                </div>
              </Field>
            </div>
          )}

          {/* ── Step 2: Interested entities ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {funds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No funds managed by this asset manager yet.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {funds.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setSelectedFunds((prev) =>
                            prev.includes(f.id)
                              ? prev.filter((x) => x !== f.id)
                              : [...prev, f.id],
                          )
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                          selectedFunds.includes(f.id)
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background hover:bg-muted",
                        )}
                      >
                        {f.name ?? f.id}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Interested in all investments?{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => setSelectedFunds(funds.map((f) => f.id))}
                    >
                      Select all
                    </button>
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Amounts (optional) ── */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                This step is optional and can be skipped if you are unsure of
                amounts.
              </p>
              {selectedFunds.length === 0 ? (
                <div className="border rounded-lg p-5 flex items-center justify-between bg-muted/30">
                  <span className="text-sm text-muted-foreground">
                    No investment entities selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(2)}
                  >
                    Go back and select
                  </Button>
                </div>
              ) : (
                <div className="border overflow-hidden rounded-md">
                  <table className="w-full border rounded-lg overflow-hidden text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Investment Entity
                        </th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-l w-44">
                          Share Class
                        </th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-l w-44">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFunds.map((id) => {
                        const fund = funds.find((f) => f.id === id);
                        const scOptions = fund?.entity ? (shareClassCache[fund.entity] ?? []) : [];
                        return (
                        <tr key={id} className="border-b last:border-0">
                          <td className="px-4 py-2.5">
                            {fund?.name ?? id}
                          </td>
                          <td className="px-2 py-2 border-l">
                            <Select
                              value={shareClasses[id] ?? ""}
                              onValueChange={(v) =>
                                setShareClasses((prev) => ({ ...prev, [id]: v }))
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                {scOptions.length === 0 ? (
                                  <SelectItem value="_none" disabled>No share classes</SelectItem>
                                ) : (
                                  scOptions.map((sc) => (
                                    <SelectItem key={sc.id} value={sc.id}>
                                      {sc.name ?? sc.id}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2 border-l">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={amounts[id] ?? ""}
                              onChange={(e) =>
                                setAmounts((prev) => ({
                                  ...prev,
                                  [id]: e.target.value,
                                }))
                              }
                              className="h-8"
                            />
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Referrer ── */}
          {step === 4 && (
            <Field>
              <FieldLabel htmlFor="inv-referrer">
                Referrer email{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </FieldLabel>
              <Input
                id="inv-referrer"
                type="email"
                placeholder="referrer@example.com"
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
              />
            </Field>
          )}

          {/* ── Step 5: IR managers + notes ── */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel>IR Managers</FieldLabel>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9"
                    placeholder="Search IR managers..."
                    value={irSearch}
                    onChange={(e) => setIrSearch(e.target.value)}
                  />
                </div>
                {irSearch.length > 0 && (
                  <div className="border rounded-md divide-y">
                    {filteredIr.length > 0 ? (
                      filteredIr.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedIr((prev) => [...prev, m]);
                            setIrSearch("");
                          }}
                        >
                          <span className="font-medium">
                            {m._user?.name ?? "Unknown"}
                          </span>
                          {m._user?.email && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {m._user.email}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No matching IR managers.
                      </p>
                    )}
                  </div>
                )}
                {selectedIr.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIr.map((m) => (
                      <Badge
                        key={m.id}
                        variant="secondary"
                        className="gap-1 pr-1.5"
                      >
                        {m._user?.name ?? "Unknown"}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedIr((prev) =>
                              prev.filter((x) => x.id !== m.id),
                            )
                          }
                          className="hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="inv-notes">
                  Notes{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FieldLabel>
                <Textarea
                  id="inv-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>
                  Documents{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FieldLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setDocuments((prev) => {
                      const existing = new Set(prev.map((f) => f.name));
                      return [
                        ...prev,
                        ...files.filter((f) => !existing.has(f.name)),
                      ];
                    });
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    setDocuments((prev) => {
                      const existing = new Set(prev.map((f) => f.name));
                      return [
                        ...prev,
                        ...files.filter((f) => !existing.has(f.name)),
                      ];
                    });
                  }}
                  className="w-full rounded-lg border-2 border-dashed border-input px-4 py-6 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors text-center"
                >
                  Drop files here or click to browse
                </button>
                {documents.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {documents.map((f) => {
                      const status = uploadStatuses[f.name];
                      return (
                        <div
                          key={f.name}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="truncate flex-1 mr-2">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 mr-2">
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                          {status === "uploading" && (
                            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                          )}
                          {status === "done" && (
                            <Check className="size-3.5 shrink-0 text-green-600" />
                          )}
                          {status === "error" && (
                            <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                          )}
                          {!status && (
                            <button
                              type="button"
                              onClick={() =>
                                setDocuments((prev) =>
                                  prev.filter((d) => d.name !== f.name),
                                )
                              }
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Field>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        {hasUploadErrors && (
          <p className="text-sm text-destructive mt-3">
            Some files failed to upload. Lead was saved successfully.
          </p>
        )}

        <DialogFooter>
          {savedLeadId ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpen(false); reset(); }}
              >
                Done
              </Button>
              {hasUploadErrors && (
                <Button onClick={retryUploads} disabled={isUploading}>
                  {isUploading ? "Retrying…" : "Retry failed uploads"}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (step === 1) {
                    setOpen(false);
                    reset();
                  } else setStep((s) => s - 1);
                }}
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              {isLastStep ? (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save & Record Lead"}
                </Button>
              ) : (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canContinue}
                >
                  Continue
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
