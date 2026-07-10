"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/components/shared/locale-context";
import { Input } from "@/components/ui/input";

export type DirectQtyField = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function HandlingDirectEntrySection({
  showDirect,
  onToggle,
  fields,
}: {
  showDirect: boolean;
  onToggle: () => void;
  fields: DirectQtyField[];
}) {
  const { tLocal } = useT();

  return (
    <div className="rounded-md border border-dashed border-haidee-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-haidee-surface/50"
        onClick={onToggle}
      >
        {showDirect ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {showDirect
          ? tLocal("thaiCost.sadaoHandling.direct")
          : tLocal("thaiCost.sadaoHandling.addDirect")}
      </button>
      {showDirect && (
        <div
          className={`grid gap-3 border-t border-haidee-border p-3 sm:grid-cols-${Math.min(fields.length, 3)}`}
          style={{
            gridTemplateColumns: `repeat(${Math.min(fields.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {fields.map((field) => (
            <label key={field.id} className="space-y-1 text-sm">
              <span>{field.label}</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                required
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function hasDirectQty(values: number[]): boolean {
  return values.some((v) => v > 0);
}
