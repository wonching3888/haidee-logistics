import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { patchCrateLoadingFee } from "@/lib/driver-expense-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const { id } = await params;
    const body = (await request.json()) as {
      loadingFeeOverride?: number | null;
    };
    const fee = await patchCrateLoadingFee(id, body);
    return NextResponse.json({ fee });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
