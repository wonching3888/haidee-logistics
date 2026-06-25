import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverExpenses } from "@/lib/auth-roles";
import { countPendingReviewVouchers } from "@/lib/driver-expense-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessDriverExpenses(user.role)) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const count = await countPendingReviewVouchers();
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
