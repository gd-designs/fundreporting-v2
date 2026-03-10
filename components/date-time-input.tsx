"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => CURRENT_YEAR - 15 + i);

function formatTime(date: Date | undefined) {
  if (!date) return "00:00:00";
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function combineDateTime(d: Date | undefined, time: string): Date | undefined {
  if (!d) return undefined;
  const parts = time.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  if (!isFinite(h) || !isFinite(m) || !isFinite(s)) return undefined;
  const combined = new Date(d);
  combined.setHours(h, m, s, 0);
  return combined;
}

type DateTimePickerInputProps = {
  id?: string;
  label?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  className?: string;
  showTime?: boolean;
};

export function DateTimePickerInput({
  id = "datetime-required",
  label = "Date & time",
  value: controlledValue,
  onChange: controlledOnChange,
  className,
  showTime = true,
}: DateTimePickerInputProps) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(() => controlledValue ?? new Date());
  const [timeText, setTimeText] = React.useState(formatTime(controlledValue));

  React.useEffect(() => {
    if (controlledValue) {
      setTimeText(formatTime(controlledValue));
      setMonth(controlledValue);
    }
  }, [controlledValue]);

  function handleDateSelect(d: Date | undefined) {
    setOpen(false);
    if (!d) return;
    controlledOnChange?.(combineDateTime(d, timeText));
  }

  function handleTimeChange(time: string) {
    setTimeText(time);
    const base = controlledValue ?? new Date();
    const combined = combineDateTime(base, time);
    if (combined) controlledOnChange?.(combined);
  }

  function handleMonthChange(val: string) {
    setMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(Number(val));
      return d;
    });
  }

  function handleYearChange(val: string) {
    setMonth((prev) => {
      const d = new Date(prev);
      d.setFullYear(Number(val));
      return d;
    });
  }

  return (
    <FieldGroup className={`flex-row items-end ${className ?? ""}`}>
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              className="w-44 justify-between font-normal"
            >
              {controlledValue ? format(controlledValue, "PPP") : "Select date"}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            {/* Month / year selects — Radix-based, safe inside a Popover */}
            <div className="flex gap-1 border-b px-2 py-1.5">
              <Select
                value={String(month.getMonth())}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="h-7 flex-1 border-0 px-2 shadow-none text-sm font-medium focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(month.getFullYear())}
                onValueChange={handleYearChange}
              >
                <SelectTrigger className="h-7 w-20 border-0 px-2 shadow-none text-sm font-medium focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Calendar
              mode="single"
              selected={controlledValue}
              month={month}
              onMonthChange={setMonth}
              onSelect={handleDateSelect}
              classNames={{ caption_label: "hidden" }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      {showTime && (
        <Field className="w-36">
          <FieldLabel htmlFor={`${id}-time`}>Time</FieldLabel>
          <Input
            type="time"
            id={`${id}-time`}
            step="1"
            value={timeText}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          />
        </Field>
      )}
    </FieldGroup>
  );
}
