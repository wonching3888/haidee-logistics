"use client";

import { Trash2 } from "lucide-react";
import { MarketBadge } from "@/components/shared/MarketBadge";

interface TongTypeOption {
  id: string;
  code: string;
  name: string;
}

interface InboundLineRowProps {
  stallCode: string;
  marketCode: string;
  tongTypes: TongTypeOption[];
  tongTypeId: string;
  quantity: string;
  tabIndex: number;
  onTongTypeChange: (tongTypeId: string) => void;
  onQuantityChange: (quantity: string) => void;
  onDelete?: () => void;
  disabled?: boolean;
}

export function InboundLineRow({
  stallCode,
  marketCode,
  tongTypes,
  tongTypeId,
  quantity,
  tabIndex,
  onTongTypeChange,
  onQuantityChange,
  onDelete,
  disabled,
}: InboundLineRowProps) {
  return (
    <tr className="border-b border-haidee-border hover:bg-white/60">
      <td className="px-3 py-2 font-mono font-medium text-haidee-text">
        {stallCode}
      </td>
      <td className="px-3 py-2">
        {marketCode ? <MarketBadge code={marketCode} /> : "—"}
      </td>
      <td className="px-3 py-2">
        <select
          value={tongTypeId}
          onChange={(e) => onTongTypeChange(e.target.value)}
          disabled={disabled}
          className="min-h-[44px] w-full min-w-[120px] rounded-lg border border-haidee-border bg-white px-3 text-sm text-haidee-text focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:opacity-50"
        >
          {tongTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={quantity}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d+$/.test(v)) onQuantityChange(v);
          }}
          disabled={disabled}
          tabIndex={tabIndex}
          placeholder=""
          className="min-h-[44px] w-full min-w-[80px] rounded-lg border border-haidee-border bg-white px-3 text-right font-mono text-lg text-haidee-text focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:opacity-50"
        />
      </td>
      {onDelete && (
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-2 text-haidee-muted hover:text-haidee-red"
            title="删除档口"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}
