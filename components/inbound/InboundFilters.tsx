"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { DateInputField } from "@/components/shared/DateInputField";
import { resolveDateParam } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="grid gap-3 rounded-xl border border-haidee-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">日期 Date</label>
        <DateInputField
          value={
            searchParams.get("date")
              ? resolveDateParam(searchParams.get("date")!)
              : ""
          }
          onChange={(next) => updateParams("date", next)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          寄货人 Consignor
        </label>
        <select
          defaultValue={searchParams.get("shipperId") ?? ""}
          onChange={(e) => updateParams("shipperId", e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm"
        >
          <option value="">全部 All</option>
          {shippers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          状态 Status
        </label>
        <select
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => updateParams("status", e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm"
        >
          <option value="">全部 All</option>
          <option value="unassigned">未分配 Unassigned</option>
          <option value="assigned">已分配 Assigned</option>
          <option value="draft">草稿 Draft</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          搜索 Search
        </label>
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="寄货人名称…"
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
            搜
          </Button>
        </div>
      </div>
    </div>
  );
}
