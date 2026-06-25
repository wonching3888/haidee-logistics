import { NextResponse } from "next/server";
import { requireDriverExpensesApi } from "@/lib/require-auth";
import {
  getDriverVoucher,
  listDriverVoucherChangeLogs,
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
    const voucher = await getDriverVoucher(id);
    if (!voucher) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const logs = await listDriverVoucherChangeLogs(id);
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
