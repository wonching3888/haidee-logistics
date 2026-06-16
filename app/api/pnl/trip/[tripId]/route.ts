import { NextResponse } from "next/server";
import { requirePnlApiAccess } from "@/lib/pnl-api-auth";
import { buildPnlTripDetail } from "@/lib/pnl-report";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requirePnlApiAccess();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { tripId } = await params;
    const { searchParams } = new URL(request.url);
    const year = parseReportYear(searchParams.get("year") ?? undefined);
    const month = parseReportMonth(searchParams.get("month") ?? undefined);

    const trip = await buildPnlTripDetail({ tripId, year, month });
    return NextResponse.json(trip);
  } catch (error) {
    console.error("PNL API Error:", error);
    const message = error instanceof Error ? error.message : "Server error";
    const status = message.includes("not found") || message.includes("不存在")
      ? 404
      : 500;
    return NextResponse.json({ error: String(error) }, { status });
  }
}
