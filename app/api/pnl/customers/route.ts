import { NextResponse } from "next/server";
import { requirePnlApiAccess } from "@/lib/pnl-api-auth";
import { buildPnlCustomerAnalysis } from "@/lib/pnl-report";
import type { PnlCustomerSort } from "@/lib/pnl-report-types";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

const CUSTOMER_SORTS: PnlCustomerSort[] = ["profit", "quantity", "revenue"];

export async function GET(request: Request) {
  try {
    const user = await requirePnlApiAccess();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseReportYear(searchParams.get("year") ?? undefined);
    const month = parseReportMonth(searchParams.get("month") ?? undefined);
    const sortRaw = searchParams.get("customerSort") ?? "profit";
    const customerSort = CUSTOMER_SORTS.includes(sortRaw as PnlCustomerSort)
      ? (sortRaw as PnlCustomerSort)
      : "profit";

    const data = await buildPnlCustomerAnalysis({
      year,
      month,
      customerSort,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
