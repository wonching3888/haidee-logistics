import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createUnloadRatesTable } from "@/lib/create-unload-rates-table";
import { listUnloadRates } from "@/lib/unload-rates-service";

/**
 * One-time setup: create unload_rates table on Postgres.
 * GET /api/setup/create-unload-rates
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    await createUnloadRatesTable();
    const rates = await listUnloadRates();

    return NextResponse.json({
      ok: true,
      message: "unload_rates table created and seeded",
      count: rates.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Setup failed",
      },
      { status: 500 }
    );
  }
}
