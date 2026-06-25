import { NextResponse } from "next/server";
import { requireDriverExpensesApi, requireDriverExpensesWriteApi } from "@/lib/require-auth";
import {
  createDriverVoucher,
  listDriverVouchers,
  suggestVoucherAmounts,
  syncTripDriverExpenses,
} from "@/lib/driver-expense-service";

export async function GET(request: Request) {
  try {
    const user = await requireDriverExpensesApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const vouchers = await listDriverVouchers({
      tripId: searchParams.get("tripId") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      q: searchParams.get("q") ?? undefined,
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
    const user = await requireDriverExpensesWriteApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const body = await request.json();
    if (body?.prepareTripId) {
      await syncTripDriverExpenses(body.prepareTripId);
      const suggestion = await suggestVoucherAmounts(body.prepareTripId);
      return NextResponse.json({ suggestion });
    }
    const { submitEntry, ...createInput } = body ?? {};
    const voucher = await createDriverVoucher(createInput, {
      actor: { id: user.id, role: user.role },
      submitEntry,
    });
    return NextResponse.json({ voucher });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
