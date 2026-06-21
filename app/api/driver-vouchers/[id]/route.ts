import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireWriteApi } from "@/lib/require-auth";
import {
  getDriverVoucher,
  updateDriverVoucher,
} from "@/lib/driver-expense-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
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
    const user = await requireWriteApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const voucher = await updateDriverVoucher(id, body);
    return NextResponse.json({ voucher });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
