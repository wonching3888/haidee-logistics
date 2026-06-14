import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listUnloadRatesMatrix,
  saveUnloadRatesBatch,
} from "@/lib/unload-rates-service";

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

    const matrix = await listUnloadRatesMatrix();
    return NextResponse.json({ matrix });
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
        marketCode: string;
        crateType: string;
        rateMyr: number;
        notes?: string | null;
      }[];
    };

    if (!Array.isArray(body.rates)) {
      return NextResponse.json(
        { error: "rates array is required" },
        { status: 400 }
      );
    }

    const rates = await saveUnloadRatesBatch(body.rates);
    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
