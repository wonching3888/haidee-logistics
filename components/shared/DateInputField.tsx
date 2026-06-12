"use client";

import { Input } from "@/components/ui/input";
import { formatDisplay } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface DateInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Native date picker (type="date") with dd/MM/yyyy display overlay.
 * Hides browser-native date text; overlay is pointer-events-none so clicks reach the input.
 */
export function DateInputField({
  value,
  onChange,
  className,
  inputClassName,
  id,
  disabled,
}: DateInputFieldProps) {
  const display = formatDisplay(value);

  return (
    <div className={cn("relative inline-block w-full max-w-[11.5rem]", className)}>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={display ? `Date ${display}` : "Select date"}
        className={cn(
          "min-h-[44px] w-full cursor-pointer font-mono tabular-nums text-transparent caret-transparent",
          "[&::-webkit-datetime-edit]:hidden",
          "[&::-webkit-datetime-edit-fields-wrapper]:hidden",
          "[&::-webkit-datetime-edit-text]:hidden",
          "[&::-webkit-datetime-edit-month-field]:hidden",
          "[&::-webkit-datetime-edit-day-field]:hidden",
          "[&::-webkit-datetime-edit-year-field]:hidden",
          "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          inputClassName
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 left-3 right-10 flex items-center font-mono text-sm tabular-nums",
          display ? "text-haidee-text" : "text-haidee-muted"
        )}
        aria-hidden="true"
      >
        {display || "DD/MM/YYYY"}
      </span>
    </div>
  );
}
