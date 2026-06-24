"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MARKET_ORDER, type MarketCode } from "@/lib/markets";
import { cn } from "@/lib/utils";

interface MarketMultiSelectProps {
  value: string[];
  onChange: (codes: string[]) => void;
}

function sortMarketCodes(codes: string[]): string[] {
  const order = new Map(MARKET_ORDER.map((code, index) => [code, index]));
  return [...codes].sort(
    (a, b) => (order.get(a as MarketCode) ?? 999) - (order.get(b as MarketCode) ?? 999)
  );
}

export function MarketMultiSelect({ value, onChange }: MarketMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedSelected = useMemo(() => sortMarketCodes(value), [value]);

  const label = useMemo(() => {
    if (value.length === 0) return "全部 All";
    if (value.length <= 3) return sortedSelected.join(", ");
    return `已选 ${value.length} 个 · ${sortedSelected.slice(0, 2).join(", ")}…`;
  }, [sortedSelected, value.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggle(code: string) {
    if (value.includes(code)) {
      onChange(value.filter((item) => item !== code));
      return;
    }
    onChange(sortMarketCodes([...value, code]));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-haidee-border bg-white px-3 text-left text-sm"
      >
        <span
          className={cn(
            "truncate",
            value.length === 0 && "text-haidee-muted"
          )}
        >
          {label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-haidee-muted transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute z-50 mt-1 max-h-64 w-full min-w-[12rem] overflow-y-auto rounded-lg border border-haidee-border bg-white py-1 shadow-md"
        >
          {MARKET_ORDER.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-haidee-surface"
            >
              <input
                type="checkbox"
                checked={value.includes(code)}
                onChange={() => toggle(code)}
                className="h-4 w-4 accent-haidee-blue"
              />
              <span className="font-mono font-medium text-haidee-text">{code}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
