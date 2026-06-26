import { NextResponse } from "next/server";
import { requireDriverExpensesApi } from "@/lib/require-auth";
import { listDriverExpenseTodoItems } from "@/lib/driver-expense-service";

export async function GET() {
  try {
    const user = await requireDriverExpensesApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const items = await listDriverExpenseTodoItems();
    const unenteredCount = items.filter((row) => row.kind === "unentered").length;
    const voucherCount = items.filter((row) => row.kind === "voucher").length;
    return NextResponse.json({
      items,
      counts: {
        total: items.length,
        unentered: unenteredCount,
        voucher: voucherCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
