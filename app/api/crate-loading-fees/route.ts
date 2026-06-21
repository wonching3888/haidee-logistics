import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireWriteApi } from "@/lib/require-auth";
import { generateCrateLoadingFeesForTrip, listCrateLoadingFees } from "@/lib/driver-expense-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const fees = await listCrateLoadingFees({
      tripId: searchParams.get("tripId") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });
    return NextResponse.json({ fees });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWriteApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const body = (await request.json()) as { tripId?: string };
    if (!body.tripId) {
      return NextResponse.json({ error: "tripId is required" }, { status: 400 });
    }
    const fees = await generateCrateLoadingFeesForTrip(body.tripId);
    return NextResponse.json({ fees });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
