import { NextResponse } from "next/server";
import { requirePnlApiAccess } from "@/lib/pnl-api-auth";
import { buildPnlTripsList } from "@/lib/pnl-report";
import type { PnlRouteFilter } from "@/lib/pnl-report-types";
import { PNL_ROUTE_FILTERS } from "@/lib/pnl-report-types";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

export async function GET(request: Request) {
  try {
    const user = await requirePnlApiAccess();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseReportYear(searchParams.get("year") ?? undefined);
    const month = parseReportMonth(searchParams.get("month") ?? undefined);
    const routeRaw = searchParams.get("routeFilter") ?? "ALL";
    const routeFilter = PNL_ROUTE_FILTERS.includes(routeRaw as PnlRouteFilter)
      ? (routeRaw as PnlRouteFilter)
      : "ALL";
    const driverFilter = searchParams.get("driverFilter") ?? "ALL";

    const data = await buildPnlTripsList({
      year,
      month,
      routeFilter,
      driverFilter,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
