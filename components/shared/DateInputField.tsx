"use client";

import { useCallback, useRef } from "react";
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
 * dd/MM/yyyy label with a full-size native date input overlay.
 * The input covers the field (not sr-only) so iOS Safari / PWA receive taps.
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

  const openPicker = useCallback(() => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;

    input.focus({ preventScroll: true });

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      }
    } catch {
      input.click();
    }
  }, [disabled]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLInputElement>) => {
      if (disabled) return;
      e.stopPropagation();
      openPicker();
    },
    [disabled, openPicker]
  );

  return (
    <div className={cn("relative inline-block w-full max-w-[11.5rem]", className)}>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none flex min-h-[44px] w-full select-none items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm",
          "font-mono tabular-nums",
          disabled && "opacity-50",
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
      </div>

      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={openPicker}
        onTouchEnd={handleTouchEnd}
        aria-label={display ? `Date ${display}` : "Select date"}
        className={cn(
          "absolute inset-0 z-10 m-0 h-full w-full min-h-[44px] cursor-pointer border-0 bg-transparent p-0 text-base",
          "touch-manipulation opacity-[0.011]",
          "[color-scheme:light]",
          "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0",
          "[&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full",
          "[&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          "[&::-webkit-calendar-picker-indicator]:touch-manipulation",
          disabled && "pointer-events-none cursor-not-allowed"
        )}
        style={{
          WebkitAppearance: "none",
          touchAction: "manipulation",
          pointerEvents: disabled ? "none" : "auto",
        }}
      />
    </div>
  );
}
