import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listCrateRentalRates,
  saveCrateRentalRatesBatch,
} from "@/lib/crate-rental-rates-service";
import type { CrateRentalCurrency } from "@/lib/crate-rental-cost";
import { normalizeCrateRentalCurrency } from "@/lib/crate-rental-cost";

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function GET() {
  try {
    const user = await requireAdminApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const rates = await listCrateRentalRates();
    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAdminApi();
    if (!user) {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    const body = (await request.json()) as {
      rates?: {
        crateType: string;
        isRental: boolean;
        rate: number;
        currency?: CrateRentalCurrency;
        notes?: string | null;
      }[];
    };

    if (!Array.isArray(body.rates)) {
      return NextResponse.json(
        { error: "rates array is required" },
        { status: 400 }
      );
    }

    const rates = await saveCrateRentalRatesBatch(
      body.rates.map((row) => ({
        ...row,
        currency: normalizeCrateRentalCurrency(row.currency),
      }))
    );
    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
