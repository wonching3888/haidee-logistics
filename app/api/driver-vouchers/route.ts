import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireWriteApi } from "@/lib/require-auth";
import {
  createDriverVoucher,
  listDriverVouchers,
  suggestVoucherAmounts,
  syncTripDriverExpenses,
} from "@/lib/driver-expense-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const vouchers = await listDriverVouchers({
      tripId: searchParams.get("tripId") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });
    return NextResponse.json({ vouchers });
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
    const body = await request.json();
    if (body?.prepareTripId) {
      await syncTripDriverExpenses(body.prepareTripId);
      const suggestion = await suggestVoucherAmounts(body.prepareTripId);
      return NextResponse.json({ suggestion });
    }
    const voucher = await createDriverVoucher(body);
    return NextResponse.json({ voucher });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
