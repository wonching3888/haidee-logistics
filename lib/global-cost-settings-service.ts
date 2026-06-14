import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  DEFAULT_GLOBAL_COST_SETTINGS,
  GLOBAL_COST_SETTING_KEYS,
  type GlobalCostSettingKey,
} from "@/lib/constants/global-cost-settings";
import { isMissingGlobalCostSettingsTableError } from "@/lib/create-global-cost-settings-table";

export interface GlobalCostSettingRow {
  id: string;
  key: GlobalCostSettingKey;
  valueMyr: number;
  label: string;
  notes: string | null;
}

function serializeRow(row: {
  id: string;
  key: string;
  valueMyr: unknown;
  label: string | null;
  notes: string | null;
}): GlobalCostSettingRow {
  return {
    id: row.id,
    key: row.key as GlobalCostSettingKey,
    valueMyr: decimalToNumber(row.valueMyr) ?? 0,
    label: row.label ?? row.key,
    notes: row.notes,
  };
}

export async function ensureGlobalCostSettingsSeeded() {
  try {
    await Promise.all(
      DEFAULT_GLOBAL_COST_SETTINGS.map((item) =>
        prisma.globalCostSetting.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            valueMyr: item.valueMyr,
            label: item.label,
            notes: item.notes,
          },
          update: {},
        })
      )
    );
  } catch (error) {
    if (isMissingGlobalCostSettingsTableError(error)) return;
    throw error;
  }
}

export async function listGlobalCostSettings(): Promise<GlobalCostSettingRow[]> {
  try {
    await ensureGlobalCostSettingsSeeded();
    const rows = await prisma.globalCostSetting.findMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return GLOBAL_COST_SETTING_KEYS.map((key) => {
      const row = byKey.get(key);
      if (row) return serializeRow(row);
      const seed = DEFAULT_GLOBAL_COST_SETTINGS.find((item) => item.key === key)!;
      return {
        id: key,
        key,
        valueMyr: seed.valueMyr,
        label: seed.label,
        notes: seed.notes,
      };
    });
  } catch (error) {
    if (isMissingGlobalCostSettingsTableError(error)) {
      return DEFAULT_GLOBAL_COST_SETTINGS.map((item) => ({
        id: item.key,
        key: item.key,
        valueMyr: item.valueMyr,
        label: item.label,
        notes: item.notes,
      }));
    }
    throw error;
  }
}

function parseValueMyr(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} 不能为负数`);
  }
  return value;
}

export async function saveGlobalCostSettingsBatch(
  input: { key: string; valueMyr: number }[]
) {
  const existing = await listGlobalCostSettings();
  const labelByKey = new Map<string, string>(
    existing.map((row) => [row.key, row.label])
  );

  await prisma.$transaction(
    input.map((item) =>
      prisma.globalCostSetting.update({
        where: { key: item.key },
        data: {
          valueMyr: parseValueMyr(
            item.valueMyr,
            labelByKey.get(item.key) ?? item.key
          ),
        },
      })
    )
  );

  return listGlobalCostSettings();
}
