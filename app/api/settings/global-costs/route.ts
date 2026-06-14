import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listGlobalCostSettings,
  saveGlobalCostSettingsBatch,
} from "@/lib/global-cost-settings-service";
import { GLOBAL_COST_SETTING_KEYS } from "@/lib/constants/global-cost-settings";

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

    const settings = await listGlobalCostSettings();
    return NextResponse.json({ settings });
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
      settings?: { key: string; valueMyr: number }[];
    };

    if (!Array.isArray(body.settings)) {
      return NextResponse.json(
        { error: "settings array is required" },
        { status: 400 }
      );
    }

    const allowed = new Set<string>(GLOBAL_COST_SETTING_KEYS);
    for (const item of body.settings) {
      if (!allowed.has(item.key)) {
        return NextResponse.json(
          { error: `Invalid key: ${item.key}` },
          { status: 400 }
        );
      }
    }

    const settings = await saveGlobalCostSettingsBatch(body.settings);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
