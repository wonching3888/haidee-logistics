"use client";

import { Copy, Trash2 } from "lucide-react";
import { MarketBadge } from "@/components/shared/MarketBadge";
import type { McDeliveryMode } from "@/lib/inbound-freight";
import { MC_MARKET_CODE } from "@/lib/inbound-freight";
import { STICKY_BODY_FIRST } from "@/lib/table-scroll";
import { cn } from "@/lib/utils";

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
  mcDeliveryMode?: McDeliveryMode;
  onTongTypeChange: (tongTypeId: string) => void;
  onQuantityChange: (quantity: string) => void;
  onMcDeliveryModeChange?: (mode: McDeliveryMode) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  showMcDelivery?: boolean;
}

export function InboundLineRow({
  stallCode,
  marketCode,
  tongTypes,
  tongTypeId,
  quantity,
  tabIndex,
  mcDeliveryMode = "self",
  onTongTypeChange,
  onQuantityChange,
  onMcDeliveryModeChange,
  onDuplicate,
  onDelete,
  disabled,
  showMcDelivery,
}: InboundLineRowProps) {
  const isMcMarket = marketCode === MC_MARKET_CODE;

  return (
    <tr className="border-b border-haidee-border hover:bg-white/60">
      <td className={cn(STICKY_BODY_FIRST, "whitespace-nowrap px-3 py-2 font-mono font-medium text-haidee-text")}>
        {stallCode}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {marketCode ? <MarketBadge code={marketCode} /> : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <select
          value={tongTypeId}
          onChange={(e) => onTongTypeChange(e.target.value)}
          disabled={disabled}
          className="min-h-[44px] min-w-[180px] rounded-lg border border-haidee-border bg-white px-3 text-sm text-haidee-text focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:opacity-50"
        >
          {tongTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
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
          className="min-h-[44px] w-28 rounded-lg border border-haidee-border bg-white px-3 text-right font-mono text-lg text-haidee-text focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:opacity-50"
        />
      </td>
      {showMcDelivery && (
        <td className="whitespace-nowrap px-3 py-2">
          {isMcMarket ? (
            <select
              value={mcDeliveryMode}
              onChange={(e) =>
                onMcDeliveryModeChange?.(e.target.value as McDeliveryMode)
              }
              disabled={disabled}
              className="min-h-[44px] min-w-[140px] rounded-lg border border-haidee-border bg-white px-3 text-sm text-haidee-text focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:opacity-50"
            >
              <option value="self">自送 Self</option>
              <option value="third_party">转第三方 3rd Party</option>
            </select>
          ) : (
            <span className="text-haidee-muted">—</span>
          )}
        </td>
      )}
      {(onDuplicate || onDelete) && (
        <td className="whitespace-nowrap px-2 py-2">
          <div className="flex items-center gap-1">
            {onDuplicate && (
              <button
                type="button"
                onClick={onDuplicate}
                className="rounded p-2 text-haidee-muted hover:text-haidee-blue"
                title="同收货人加一行 Add line (same receiver)"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded p-2 text-haidee-muted hover:text-haidee-red"
                title="删除 Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
