import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listDispatchesForExpenseDate } from "@/lib/driver-expense-service";
import { toDateInputValue } from "@/lib/date-utils";
import { formatTripRouteLabel } from "@/lib/trip-allowance";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    const dispatches = await listDispatchesForExpenseDate(date);
    return NextResponse.json({
      dispatches: dispatches.map((d) => ({
        id: d.id,
        lorry: d.truck.plate,
        driver: d.driverName ?? "",
        route: formatTripRouteLabel(d.markets),
        date: toDateInputValue(d.date),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
