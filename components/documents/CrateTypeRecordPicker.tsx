"use client";

import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CrateTypeRecordOption {
  code: string;
  header: string;
}

interface CrateTypeRecordPickerProps {
  markets: string[];
  crateTypes: CrateTypeRecordOption[];
  selectedMarkets: string[];
  selectedTongCodes: string[];
  onToggleMarket: (code: string) => void;
  onToggleTongCode: (code: string) => void;
  onSelectAllMarkets: (selectAll: boolean) => void;
  onSelectAllTongCodes: (selectAll: boolean) => void;
}

function SelectAllButton({
  allSelected,
  onToggle,
}: {
  allSelected: boolean;
  onToggle: (selectAll: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 px-3 text-xs"
      onClick={() => onToggle(!allSelected)}
    >
      全选 All
    </Button>
  );
}

function TongTypeBadge({
  code,
  header,
  selected,
}: {
  code: string;
  header: string;
  selected: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-[32px] min-w-[44px] items-center justify-center rounded border px-2.5 py-1 font-mono text-sm font-semibold",
        selected
          ? "border-haidee-navy bg-haidee-accent/20 text-haidee-text"
          : "border-haidee-border bg-white text-haidee-muted"
      )}
      title={header}
    >
      {code}
    </span>
  );
}

export function CrateTypeRecordPicker({
  markets,
  crateTypes,
  selectedMarkets,
  selectedTongCodes,
  onToggleMarket,
  onToggleTongCode,
  onSelectAllMarkets,
  onSelectAllTongCodes,
}: CrateTypeRecordPickerProps) {
  const allMarketsSelected =
    markets.length > 0 && selectedMarkets.length === markets.length;
  const allTongsSelected =
    crateTypes.length > 0 &&
    selectedTongCodes.length === crateTypes.length;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-haidee-text">
            目的市场 Markets
          </span>
          <SelectAllButton
            allSelected={allMarketsSelected}
            onToggle={onSelectAllMarkets}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {markets.map((code) => {
            const checked = selectedMarkets.includes(code);
            return (
              <label
                key={code}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                  checked
                    ? "border-haidee-navy/30 bg-haidee-accent/10"
                    : "border-haidee-border hover:bg-haidee-surface/60"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleMarket(code)}
                  className="h-4 w-4 accent-haidee-blue"
                />
                <DispatchMarketLabel code={code} />
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-haidee-text">
            桶型 Crate Types
          </span>
          <SelectAllButton
            allSelected={allTongsSelected}
            onToggle={onSelectAllTongCodes}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {crateTypes.map((crateType) => {
            const checked = selectedTongCodes.includes(crateType.code);
            return (
              <label
                key={crateType.code}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                  checked
                    ? "border-haidee-navy/30 bg-haidee-accent/10"
                    : "border-haidee-border hover:bg-haidee-surface/60"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleTongCode(crateType.code)}
                  className="h-4 w-4 accent-haidee-blue"
                />
                <TongTypeBadge
                  code={crateType.code}
                  header={crateType.header}
                  selected={checked}
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
