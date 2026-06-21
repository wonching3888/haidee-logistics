import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGlobalCostSettingsTable } from "@/lib/create-global-cost-settings-table";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";

/**
 * One-time setup: create global_cost_settings table and drop global fee columns
 * from route_masters. GET /api/setup/create-global-cost-settings
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "无权限 Unauthorized" }, { status: 403 });
    }

    await createGlobalCostSettingsTable();
    const settings = await listGlobalCostSettings();

    return NextResponse.json({
      ok: true,
      message: "global_cost_settings table created and route global columns removed",
      count: settings.length,
      settings,
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
