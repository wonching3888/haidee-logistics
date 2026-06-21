import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listCrateLoadingRateConfigs,
  upsertCrateLoadingRateConfig,
} from "@/lib/driver-expense-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const rates = await listCrateLoadingRateConfigs();
    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const body = (await request.json()) as {
      market?: string;
      smallTruck?: number;
      largeTruck?: number;
    };
    if (!body.market) {
      return NextResponse.json({ error: "market is required" }, { status: 400 });
    }
    const rate = await upsertCrateLoadingRateConfig({
      market: body.market.toUpperCase(),
      smallTruck: Number(body.smallTruck ?? 0),
      largeTruck: Number(body.largeTruck ?? 0),
    });
    return NextResponse.json({ rate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
