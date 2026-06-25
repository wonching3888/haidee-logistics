import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverExpenses } from "@/lib/auth-roles";
import {
  isVoucherStatus,
  transitionVoucherStatus,
  VoucherStatusTransitionError,
} from "@/lib/driver-voucher-status";

async function requireVoucherTransitionApi() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canAccessDriverExpenses(user.role) && user.role !== "thai_accounting") {
    return null;
  }
  return user;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireVoucherTransitionApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      toStatus?: string;
      note?: string | null;
    };

    if (!body?.toStatus || !isVoucherStatus(body.toStatus)) {
      return NextResponse.json(
        { error: "无效目标状态 / Invalid toStatus" },
        { status: 400 }
      );
    }

    const voucher = await transitionVoucherStatus({
      voucherId: id,
      toStatus: body.toStatus,
      actor: { id: user.id, role: user.role },
      note: body.note,
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
