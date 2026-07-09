"use client";

import Link from "next/link";
import { useT } from "@/components/shared/locale-context";

export function DriverTripsEntryBanner() {
  const { tLocal } = useT();
  return (
    <div className="rounded-md border border-haidee-blue/30 bg-haidee-blue/5 px-4 py-3 text-sm">
      <p>{tLocal("thaiCost.driverTrips.entryMovedBanner")}</p>
      <Link
        href="/thai-cost/handling"
        className="mt-1 inline-block text-haidee-blue underline"
      >
        {tLocal("thaiCost.driverTrips.entryMovedBannerLink")} →
      </Link>
    </div>
  );
}
