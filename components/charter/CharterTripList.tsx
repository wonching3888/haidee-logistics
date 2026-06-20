"use client";

import Link from "next/link";
import { charterCargoTypeLabel, type CharterTripListItem } from "@/lib/charter";

interface CharterTripListProps {
  trips: CharterTripListItem[];
}

function formatMyr(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CharterTripList({ trips }: CharterTripListProps) {
  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white px-4 py-10 text-center text-sm text-haidee-muted">
        本日暂无包车记录 No charter trips for this date.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-haidee-border bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-haidee-border bg-haidee-surface/40 text-left text-haidee-muted">
            <th className="px-4 py-3 font-medium">单号 No.</th>
            <th className="px-4 py-3 font-medium">货类 Type</th>
            <th className="px-4 py-3 font-medium">车牌 Truck</th>
            <th className="px-4 py-3 font-medium">司机 Driver</th>
            <th className="px-4 py-3 font-medium text-right">收入 Revenue</th>
            <th className="px-4 py-3 font-medium text-right">公里 km</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id} className="border-b border-haidee-border/60">
              <td className="px-4 py-3 font-mono">{trip.charterNo ?? "—"}</td>
              <td className="px-4 py-3">{charterCargoTypeLabel(trip.cargoType)}</td>
              <td className="px-4 py-3">{trip.truckPlate}</td>
              <td className="px-4 py-3">{trip.driverName ?? "—"}</td>
              <td className="px-4 py-3 text-right font-mono">
                {formatMyr(trip.charterRevenueMyr)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {trip.charterMileageKm.toLocaleString("en-MY")}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/charter/${trip.id}`}
                  className="inline-flex min-h-[44px] items-center text-haidee-blue hover:underline"
                >
                  编辑 Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
