import { NextResponse } from "next/server";
import { buildPnlTripsList } from "@/lib/pnl-report";

export async function GET() {
  try {
    const data = await buildPnlTripsList({
      year: 2026,
      month: 6,
      day: null,
      routeFilter: "ALL",
      driverFilter: "ALL",
    });

    return NextResponse.json({
      tripsLength: data.trips.length,
      driversLength: data.drivers.length,
      totalsTripCount: data.totals.tripCount,
    });
  } catch (error) {
    console.error("PNL debug-trips Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
