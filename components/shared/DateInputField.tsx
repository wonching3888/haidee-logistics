"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
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
 * Pure dd/MM/yyyy label on a button; hidden type="date" opens via showPicker().
 * Avoids native date-input caret / webkit edit artifacts in the visible text.
 */
export function DateInputField({
  value,
  onChange,
  className,
  inputClassName,
  id,
  disabled,
}: DateInputFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = formatDisplay(value);

  function openPicker() {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  }

  return (
    <div className={cn("relative inline-block w-full max-w-[11.5rem]", className)}>
      <button
        type="button"
        id={id}
        onClick={openPicker}
        disabled={disabled}
        aria-label={display ? `Date ${display}` : "Select date"}
        className={cn(
          "flex min-h-[44px] w-full cursor-pointer select-none items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors md:text-sm",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
          "font-mono tabular-nums",
          inputClassName
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            display ? "text-haidee-text" : "text-haidee-muted"
          )}
        >
          {display || "DD/MM/YYYY"}
        </span>
        <CalendarDays
          className="h-4 w-4 shrink-0 text-haidee-muted"
          aria-hidden
        />
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </div>
  );
}
