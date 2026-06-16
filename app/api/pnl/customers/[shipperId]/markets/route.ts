import { NextResponse } from "next/server";
import { requirePnlApiAccess } from "@/lib/pnl-api-auth";
import { buildPnlCustomerMarketBreakdown } from "@/lib/pnl-report";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shipperId: string }> }
) {
  try {
    const user = await requirePnlApiAccess();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { shipperId } = await params;
    const { searchParams } = new URL(request.url);
    const year = parseReportYear(searchParams.get("year") ?? undefined);
    const month = parseReportMonth(searchParams.get("month") ?? undefined);

    const markets = await buildPnlCustomerMarketBreakdown({
      shipperId,
      year,
      month,
    });
    return NextResponse.json({ markets });
  } catch (error) {
    console.error("PNL API Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
