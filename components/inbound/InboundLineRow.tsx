"use client";

import { Copy, Trash2 } from "lucide-react";
import { MarketBadge } from "@/components/shared/MarketBadge";
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
  onTongTypeChange: (tongTypeId: string) => void;
  onQuantityChange: (quantity: string) => void;
  onDuplicate?: () => void;
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
  onDuplicate,
  onDelete,
  disabled,
}: InboundLineRowProps) {
  return (
    <tr className="border-b border-haidee-border/60 hover:bg-haidee-surface/50">
      <td
        className={cn(
          "whitespace-nowrap px-3 py-2 font-mono text-sm font-medium text-haidee-text",
          STICKY_BODY_FIRST
        )}
      >
        {stallCode}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <MarketBadge code={marketCode} />
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <select
          value={tongTypeId}
          onChange={(e) => onTongTypeChange(e.target.value)}
          disabled={disabled}
          tabIndex={tabIndex}
          className="min-h-[44px] min-w-[120px] rounded-lg border border-haidee-border bg-white px-3 text-sm text-haidee-text focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:opacity-50"
        >
          {tongTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} {t.name ? `· ${t.name}` : ""}
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
