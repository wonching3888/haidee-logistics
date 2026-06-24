"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DataFreshnessBar } from "@/components/shared/DataFreshnessBar";
import { resolveInboundListQueryDate } from "@/lib/inbound-list";

export function InboundListFreshnessBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo(() => {
    const date = resolveInboundListQueryDate(searchParams.get("date") ?? undefined);
    return {
      date,
      shipperId: searchParams.get("shipperId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    };
  }, [searchParams]);

  return (
    <DataFreshnessBar
      scope="inbound"
      params={params}
      onRefresh={() => router.refresh()}
    />
  );
}
