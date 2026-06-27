import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverExpenses } from "@/lib/auth-roles";
import {
  reopenVoucherStatus,
  VoucherStatusTransitionError,
} from "@/lib/driver-voucher-status";

async function requireVoucherReopenApi() {
  const user = await getCurrentUser();
  if (!user || !canAccessDriverExpenses(user.role)) {
    return null;
  }
  return user;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireVoucherReopenApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      note?: string | null;
    };

    const voucher = await reopenVoucherStatus({
      voucherId: id,
      actor: { id: user.id, role: user.role },
      note: body?.note,
    });

    return NextResponse.json({ voucher });
  } catch (error) {
    if (error instanceof VoucherStatusTransitionError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
            ? 403
            : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
