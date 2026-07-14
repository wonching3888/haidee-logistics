import { NextResponse } from "next/server";
import { requireDriverExpensesApi, requireDriverExpensesWriteApi } from "@/lib/require-auth";
import {
  getDriverVoucher,
  updateDriverVoucher,
} from "@/lib/driver-expense-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDriverExpensesApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { id } = await params;
    if (id === "suggest") {
      return NextResponse.json({ error: "Use trip suggest endpoint" }, { status: 400 });
    }
    const voucher = await getDriverVoucher(id);
    if (!voucher) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ voucher });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDriverExpensesWriteApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const { submitEntry, recordAdvanceOnly, ...patch } = body ?? {};
    const voucher = await updateDriverVoucher(id, patch, {
      actor: { id: user.id, role: user.role },
      submitEntry,
      recordAdvanceOnly,
    });
    return NextResponse.json({ voucher });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
