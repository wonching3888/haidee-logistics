import { NextResponse } from "next/server";
import { requirePnlApiAccess } from "@/lib/pnl-api-auth";
import { buildPnlCustomerAnalysis } from "@/lib/pnl-report";
import type { PnlCustomerSort } from "@/lib/pnl-report-types";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

const CUSTOMER_SORTS: PnlCustomerSort[] = ["profit", "quantity", "revenue"];

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    console.error("PNL API Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
