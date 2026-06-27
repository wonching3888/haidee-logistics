import { NextResponse } from "next/server";
import { requireDriverExpensesApi } from "@/lib/require-auth";
import { listTripsForExpenseDate } from "@/lib/driver-expense-service";

export async function GET(request: Request) {
  try {
    const user = await requireDriverExpensesApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    const trips = await listTripsForExpenseDate(date);
    return NextResponse.json({
      dispatches: trips.filter((t) => t.tripSource === "dispatch"),
      charters: trips.filter((t) => t.tripSource === "charter"),
      trips,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
