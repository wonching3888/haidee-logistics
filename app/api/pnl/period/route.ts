import { NextResponse } from "next/server";
import { requirePnlApiAccess } from "@/lib/pnl-api-auth";
import { buildPnlPeriodSummary } from "@/lib/pnl-report";
import type { PnlPeriodMode } from "@/lib/pnl-report-types";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

const PERIOD_MODES: PnlPeriodMode[] = ["day", "range", "month", "year"];

export async function GET(request: Request) {
  try {
    const user = await requirePnlApiAccess();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseReportYear(searchParams.get("year") ?? undefined);
    const month = parseReportMonth(searchParams.get("month") ?? undefined);
    const periodModeRaw = searchParams.get("periodMode") ?? "month";
    const periodMode = PERIOD_MODES.includes(periodModeRaw as PnlPeriodMode)
      ? (periodModeRaw as PnlPeriodMode)
      : "month";

    const data = await buildPnlPeriodSummary({
      year,
      month,
      periodMode,
      day: searchParams.get("day") ?? undefined,
      rangeStart: searchParams.get("rangeStart") ?? undefined,
      rangeEnd: searchParams.get("rangeEnd") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
