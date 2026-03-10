"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { CalendarIcon } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => CURRENT_YEAR - 15 + i);

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !isNaN(date.getTime());
}

type DatePickerInputProps = {
  id?: string;
  label?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
};

export function DatePickerInput({
  id = "date-required",
  label = "Date",
  value: controlledValue,
  onChange: controlledOnChange,
  placeholder = "June 01, 2025",
  className,
}: DatePickerInputProps) {
  const isControlled = controlledValue !== undefined || controlledOnChange !== undefined;
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(
    isControlled ? controlledValue : new Date("2025-06-01"),
  );
  const [month, setMonth] = React.useState<Date>(
    (isControlled ? controlledValue : date) ?? new Date(),
  );
  const [value, setValue] = React.useState(formatDate(isControlled ? controlledValue : date));

  React.useEffect(() => {
    if (isControlled) {
      setValue(formatDate(controlledValue));
      if (controlledValue) setMonth(controlledValue);
    }
  }, [controlledValue, isControlled]);

  function handleDateSelect(d: Date | undefined) {
    setDate(d);
    setValue(formatDate(d));
    setOpen(false);
    controlledOnChange?.(d);
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
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const parsed = new Date(e.target.value);
            setValue(e.target.value);
            if (isValidDate(parsed)) {
              handleDateSelect(parsed);
              setMonth(parsed);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <InputGroupButton
                id="date-picker"
                variant="ghost"
                size="icon-xs"
                aria-label="Select date"
              >
                <CalendarIcon />
                <span className="sr-only">Select date</span>
              </InputGroupButton>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="end"
              alignOffset={-8}
              sideOffset={10}
            >
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
                selected={date}
                month={month}
                onMonthChange={setMonth}
                onSelect={handleDateSelect}
                classNames={{ caption_label: "hidden" }}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
