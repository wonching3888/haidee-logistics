import { NextResponse } from "next/server";
import { requireDriverExpensesApi } from "@/lib/require-auth";
import {
  listUnloadingRateConfigs,
  upsertBmPindahTripUnloadRates,
  upsertUnloadingRateConfig,
} from "@/lib/driver-expense-service";

async function requireAuth() {
  return requireDriverExpensesApi();
}

async function requireAdminApi() {
  const user = await requireAuth();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const rates = await listUnloadingRateConfigs();
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
    const user = await requireAdminApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }
    const body = (await request.json()) as {
      market?: string;
      smallCrate?: number;
      largeCrate?: number;
      box?: number;
      kpbSmall?: number;
      kpbLarge?: number;
      kpbBox?: number;
      kpbMode?: string;
      unloadMode?: string;
      perTripSmallTruck?: number;
      perTripLargeTruck?: number;
      thirdPartyFlatUnload?: number | null;
      syncBmPindahGroup?: boolean;
    };
    if (body.syncBmPindahGroup) {
      const rates = await upsertBmPindahTripUnloadRates({
        perTripSmallTruck: Number(body.perTripSmallTruck ?? 0),
        perTripLargeTruck: Number(body.perTripLargeTruck ?? 0),
      });
      return NextResponse.json({ rates });
    }
    if (!body.market) {
      return NextResponse.json({ error: "market is required" }, { status: 400 });
    }
    const rate = await upsertUnloadingRateConfig({
      market: body.market.toUpperCase(),
      smallCrate: Number(body.smallCrate ?? 0),
      largeCrate: Number(body.largeCrate ?? 0),
      box: Number(body.box ?? 0),
      kpbSmall: Number(body.kpbSmall ?? 0),
      kpbLarge: Number(body.kpbLarge ?? 0),
      kpbBox: Number(body.kpbBox ?? 0),
      kpbMode: body.kpbMode ?? "per_crate",
      unloadMode: body.unloadMode ?? "per_crate",
      perTripSmallTruck: body.perTripSmallTruck ?? null,
      perTripLargeTruck: body.perTripLargeTruck ?? null,
      thirdPartyFlatUnload: body.thirdPartyFlatUnload ?? null,
    });
    return NextResponse.json({ rate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
