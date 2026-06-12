"use client";

import { useId } from "react";
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
 * Shows a single dd/MM/yyyy label; invisible native date input on top opens the picker.
 * Avoids double date text on iPad/Safari where webkit datetime-edit cannot be fully hidden.
 */
export function DateInputField({
  value,
  onChange,
  className,
  inputClassName,
  id,
  disabled,
}: DateInputFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const display = formatDisplay(value);

  return (
    <div className={cn("relative inline-block w-full max-w-[11.5rem]", className)}>
      <Input
        id={fieldId}
        type="text"
        readOnly
        value={display}
        placeholder="DD/MM/YYYY"
        disabled={disabled}
        tabIndex={-1}
        className={cn(
          "min-h-[44px] w-full cursor-default font-mono tabular-nums",
          inputClassName
        )}
        aria-hidden="true"
      />
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={display ? `Date ${display}` : "Select date"}
        className={cn(
          "absolute inset-0 z-10 min-h-[44px] w-full cursor-pointer opacity-0",
          disabled && "pointer-events-none"
        )}
      />
    </div>
  );
}
