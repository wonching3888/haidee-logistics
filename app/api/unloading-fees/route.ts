import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  syncUnloadingFeeEstimatesForTrip,
  listUnloadingFees,
  syncTripDriverExpenses,
} from "@/lib/driver-expense-service";

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const fees = await listUnloadingFees({
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
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const body = (await request.json()) as { tripId?: string; syncAll?: boolean };
    if (!body.tripId) {
      return NextResponse.json({ error: "tripId is required" }, { status: 400 });
    }
    if (body.syncAll) {
      const result = await syncTripDriverExpenses(body.tripId);
      return NextResponse.json(result);
    }
    const fees = await syncUnloadingFeeEstimatesForTrip(body.tripId);
    return NextResponse.json({ fees });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
