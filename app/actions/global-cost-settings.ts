"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  listGlobalCostSettings,
  saveGlobalCostSettingsBatch,
  type GlobalCostSettingRow,
} from "@/lib/global-cost-settings-service";
import { GLOBAL_COST_SETTING_KEYS } from "@/lib/constants/global-cost-settings";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getGlobalCostSettings(): Promise<GlobalCostSettingRow[]> {
  await requireAdmin();
  return listGlobalCostSettings();
}

export async function saveGlobalCostSettings(input: {
  settings: { key: string; valueMyr: number }[];
}): Promise<GlobalCostSettingRow[]> {
  await requireAdmin();

  const allowed = new Set<string>(GLOBAL_COST_SETTING_KEYS);
  for (const item of input.settings) {
    if (!allowed.has(item.key)) {
      throw new Error(`无效的全局费用键 Invalid key: ${item.key}`);
    }
  }

  const settings = await saveGlobalCostSettingsBatch(input.settings);
  revalidatePath("/settings");
  return settings;
}
