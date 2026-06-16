import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { nextVoucherNo } from "@/lib/driver-expense-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const voucherNo = await nextVoucherNo(
      searchParams.get("tripDate") ?? undefined
    );
    return NextResponse.json({ voucherNo });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
