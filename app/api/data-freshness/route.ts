import { NextResponse } from "next/server";
import { resolveDataFreshnessFingerprint } from "@/lib/data-freshness/scopes";
import type { DataFreshnessScope } from "@/lib/data-freshness/types";
import { getCurrentUser } from "@/lib/auth";
import { canWrite } from "@/lib/auth-roles";

export const dynamic = "force-dynamic";

const SCOPES: DataFreshnessScope[] = [
  "inbound",
  "daily-ops",
  "customer-crate-stock",
  "monthly-invoice",
];

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录 Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") as DataFreshnessScope | null;

    if (!scope || !SCOPES.includes(scope)) {
      return NextResponse.json({ error: "无效范围 Invalid scope" }, { status: 400 });
    }

    if (scope === "customer-crate-stock" && !canWrite(user.role)) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const fingerprint = await resolveDataFreshnessFingerprint(scope, searchParams);

    return NextResponse.json({
      fingerprint,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Data freshness API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
