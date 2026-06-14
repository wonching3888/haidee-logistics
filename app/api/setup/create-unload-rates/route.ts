import { NextResponse } from "next/server";
import { createUnloadRatesTable } from "@/lib/create-unload-rates-table";
import { listUnloadRates } from "@/lib/unload-rates-service";

/**
 * One-time setup: create unload_rates table on Postgres.
 * GET /api/setup/create-unload-rates
 */
export async function GET() {
  try {
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
