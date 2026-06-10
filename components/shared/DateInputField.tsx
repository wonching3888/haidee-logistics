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
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn("min-h-[44px] w-auto", inputClassName)}
      />
      <span
        className="min-w-[5.5rem] font-mono text-sm tabular-nums text-haidee-muted"
        aria-label={display ? `Selected date ${display}` : "Date format DD/MM/YYYY"}
      >
        {display || "DD/MM/YYYY"}
      </span>
    </div>
  );
}
