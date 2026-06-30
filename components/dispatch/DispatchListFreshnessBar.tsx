"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DataFreshnessBar } from "@/components/shared/DataFreshnessBar";
import { resolveDispatchDateParam } from "@/lib/date-utils";

export function DispatchListFreshnessBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo(
    () => ({
      date: resolveDispatchDateParam(searchParams.get("date") ?? undefined),
    }),
    [searchParams]
  );

  return (
    <DataFreshnessBar
      scope="daily-ops"
      params={params}
      onRefresh={() => router.refresh()}
    />
  );
}
