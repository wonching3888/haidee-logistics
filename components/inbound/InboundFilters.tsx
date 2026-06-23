"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { DateInputField } from "@/components/shared/DateInputField";
import { useT } from "@/components/shared/locale-context";
import {
  hasActiveInboundListFilters,
  INBOUND_LIST_ALL_DATES,
  resolveInboundListDateFieldValue,
} from "@/lib/inbound-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ShipperOption {
  id: string;
  name: string;
}

interface InboundFiltersProps {
  shippers: ShipperOption[];
}

export function InboundFilters({ shippers }: InboundFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, parts } = useT();

  const filtersActive = hasActiveInboundListFilters({
    date: searchParams.get("date"),
    shipperId: searchParams.get("shipperId"),
    status: searchParams.get("status"),
    search: searchParams.get("search"),
  });

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.push(`/inbound?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const dateLabel = parts("common.date");
  const consignorLabel = parts("common.consignor");
  const statusLabel = parts("common.status");
  const searchLabel = parts("common.search");
  const filterToggleLabel = parts("inbound.filterToggle");
  const filtersActiveLabel = parts("inbound.filtersActive");

  return (
    <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left md:hidden"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="flex min-w-0 items-center gap-2 font-medium text-haidee-text">
          <span className="truncate">
            {filterToggleLabel.local} {filterToggleLabel.en}
          </span>
          {filtersActive ? (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-haidee-blue/10 px-2 py-0.5 text-xs font-medium text-haidee-blue"
              title={`${filtersActiveLabel.local} ${filtersActiveLabel.en}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-haidee-blue"
                aria-hidden
              />
              <span className="sr-only">
                {filtersActiveLabel.local} {filtersActiveLabel.en}
              </span>
              <span aria-hidden>{filtersActiveLabel.local}</span>
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-haidee-muted transition-transform duration-200",
            mobileOpen && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          "grid gap-3 border-haidee-border p-4 sm:grid-cols-2 lg:grid-cols-4",
          mobileOpen ? "grid border-t" : "hidden",
          "md:grid md:border-t-0"
        )}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            {dateLabel.local} {dateLabel.en}
          </label>
          <DateInputField
            value={resolveInboundListDateFieldValue(searchParams.get("date"))}
            onChange={(next) =>
              updateParams("date", next || INBOUND_LIST_ALL_DATES)
            }
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            {consignorLabel.local} {consignorLabel.en}
          </label>
          <select
            defaultValue={searchParams.get("shipperId") ?? ""}
            onChange={(e) => updateParams("shipperId", e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm"
          >
            <option value="">{t("common.all")}</option>
            {shippers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            {statusLabel.local} {statusLabel.en}
          </label>
          <select
            defaultValue={searchParams.get("status") ?? ""}
            onChange={(e) => updateParams("status", e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm"
          >
            <option value="">{t("common.all")}</option>
            <option value="unassigned">{t("inbound.unassigned")}</option>
            <option value="assigned">{t("inbound.statusAssigned")}</option>
            <option value="draft">{t("common.draft")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            {searchLabel.local} {searchLabel.en}
          </label>
          <div className="flex gap-2">
            <Input
              type="search"
              placeholder={parts("inbound.searchPlaceholder").local}
              defaultValue={searchParams.get("search") ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateParams("search", (e.target as HTMLInputElement).value);
                }
              }}
              className="min-h-[44px]"
            />
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>(
                  'input[type="search"]'
                );
                updateParams("search", input?.value ?? "");
              }}
              className="min-h-[44px] shrink-0"
            >
              {parts("inbound.searchButton").local}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
