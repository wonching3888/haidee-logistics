import { NextResponse } from "next/server";
import { requirePnlApiAccess } from "@/lib/pnl-api-auth";
import { buildPnlTripsList } from "@/lib/pnl-report";
import type { PnlRouteFilter } from "@/lib/pnl-report-types";
import { PNL_ROUTE_FILTERS } from "@/lib/pnl-report-types";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const dbUrl = process.env.DATABASE_URL || "MISSING";
  const refMatch =
    dbUrl.match(/postgres\.([a-z0-9]+)/) ||
    dbUrl.match(/db\.([a-z0-9]+)\.supabase/);
  console.log("[DEBUG] DB project ref:", refMatch ? refMatch[1] : "NOT_FOUND");

  try {
    const user = await requirePnlApiAccess();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseReportYear(searchParams.get("year") ?? undefined);
    const month = parseReportMonth(searchParams.get("month") ?? undefined);
    const dayRaw = searchParams.get("day");
    const day = dayRaw && dayRaw.trim() ? dayRaw.trim() : null;
    const routeRaw = searchParams.get("routeFilter") ?? "ALL";
    const routeFilter = PNL_ROUTE_FILTERS.includes(routeRaw as PnlRouteFilter)
      ? (routeRaw as PnlRouteFilter)
      : "ALL";
    const driverFilter = searchParams.get("driverFilter") ?? "ALL";

    const data = await buildPnlTripsList({
      year,
      month,
      day,
      routeFilter,
      driverFilter,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("PNL API Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
