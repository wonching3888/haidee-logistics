"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { DateInputField } from "@/components/shared/DateInputField";
import { useT } from "@/components/shared/locale-context";
import {
  INBOUND_LIST_ALL_DATES,
  resolveInboundListDateFieldValue,
} from "@/lib/inbound-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const { t, parts } = useT();

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

  return (
    <div className="grid gap-3 rounded-xl border border-haidee-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
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
  );
}
