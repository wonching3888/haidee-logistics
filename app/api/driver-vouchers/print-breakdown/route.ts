import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getVoucherPrintBreakdown } from "@/lib/driver-expense-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const tripId = new URL(request.url).searchParams.get("tripId");
    if (!tripId) {
      return NextResponse.json({ error: "tripId is required" }, { status: 400 });
    }
    const breakdown = await getVoucherPrintBreakdown(tripId);
    return NextResponse.json({ breakdown });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
