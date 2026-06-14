import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import { createCrateRentalRatesTable } from "@/lib/create-crate-rental-rates-table";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";

/**
 * One-time setup: create crate_rental_rates table on Supabase Postgres.
 * Visit while logged in as admin: GET /api/setup/create-crate-rental-rates
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    // Verify Supabase admin client is configured (same project as DATABASE_URL).
    const supabaseAdmin = createAdminClient();
    const { error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (authError) {
      return NextResponse.json(
        { error: `Supabase admin unavailable: ${authError.message}` },
        { status: 500 }
      );
    }

    await createCrateRentalRatesTable();
    const rates = await listCrateRentalRates();

    return NextResponse.json({
      ok: true,
      message: "crate_rental_rates table created and seeded",
      count: rates.length,
      rates,
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
