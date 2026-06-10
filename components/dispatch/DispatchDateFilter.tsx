"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { resolveDateParam, toDateInputValue } from "@/lib/date-utils";

export function DispatchDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = toDateInputValue(new Date());
  const value = searchParams.get("date")
    ? resolveDateParam(searchParams.get("date")!)
    : today;

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-haidee-text">日期 Date</label>
      <Input
        type="date"
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("date", e.target.value);
          router.push(`/dispatch?${params.toString()}`);
        }}
        className="min-h-[44px] w-auto"
      />
    </div>
  );
}
