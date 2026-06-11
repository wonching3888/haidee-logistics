"use client";

import { useMemo } from "react";
import type { MarketTongCombo } from "@/app/actions/documents";
import { MarketBadge } from "@/components/shared/MarketBadge";
import { BOX_COLUMN_CODE, DO_TONG_COLUMNS } from "@/lib/constants/tong-columns";
import { MARKET_ORDER } from "@/lib/markets";
import { cn } from "@/lib/utils";

export interface CrateTypeColumn {
  tongCode: string;
  tongHeader: string;
  items: MarketTongCombo[];
}

export function buildCrateTypeColumns(
  combos: MarketTongCombo[]
): CrateTypeColumn[] {
  const tongOrder = new Map<string, number>(
    DO_TONG_COLUMNS.map((col, index) => [col.code, index])
  );
  const marketOrder = new Map<string, number>(
    MARKET_ORDER.map((code, index) => [code, index])
  );

  const byTong = new Map<string, MarketTongCombo[]>();

  for (const combo of combos) {
    if (combo.quantity <= 0 || combo.tongCode === BOX_COLUMN_CODE) continue;
    const list = byTong.get(combo.tongCode) ?? [];
    list.push(combo);
    byTong.set(combo.tongCode, list);
  }

  return Array.from(byTong.entries())
    .sort(
      ([a], [b]) =>
        (tongOrder.get(a) ?? 999) - (tongOrder.get(b) ?? 999)
    )
    .map(([tongCode, items]) => ({
      tongCode,
      tongHeader: items[0]?.tongHeader ?? tongCode,
      items: [...items].sort(
        (a, b) =>
          (marketOrder.get(a.marketCode) ?? 999) -
          (marketOrder.get(b.marketCode) ?? 999)
      ),
    }));
}

function comboKey(marketCode: string, tongCode: string) {
  return `${marketCode}:${tongCode}`;
}

interface CrateByTypePickerProps {
  combos: MarketTongCombo[];
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
}

export function CrateByTypePicker({
  combos,
  selectedKeys,
  onToggle,
}: CrateByTypePickerProps) {
  const columns = useMemo(() => buildCrateTypeColumns(combos), [combos]);

  if (columns.length === 0) {
    return <p className="text-sm text-haidee-muted">当日无已分配货物</p>;
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-min gap-3">
        {columns.map((column) => (
          <div
            key={column.tongCode}
            className="w-[132px] shrink-0 overflow-hidden rounded-lg border border-haidee-border bg-white"
          >
            <div className="border-b border-haidee-border bg-haidee-surface px-2 py-2 text-center font-mono text-sm font-bold text-haidee-text">
              {column.tongHeader}
            </div>
            <ul className="space-y-0.5 p-2">
              {column.items.map((item) => {
                const key = comboKey(item.marketCode, item.tongCode);
                const checked = selectedKeys.has(key);
                return (
                  <li key={key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 hover:bg-haidee-surface/80",
                        checked && "bg-haidee-accent/15"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(key)}
                        className="h-4 w-4 shrink-0 accent-haidee-blue"
                      />
                      <MarketBadge
                        code={item.marketCode}
                        className="min-h-[24px] min-w-[32px] px-1.5 text-[10px]"
                      />
                      <span className="ml-auto font-mono text-sm tabular-nums text-haidee-text">
                        {item.quantity}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
