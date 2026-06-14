"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  listUnloadRates,
  listUnloadRatesMatrix,
  saveUnloadRatesBatch,
  type UnloadRateRow,
} from "@/lib/unload-rates-service";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getUnloadRates(): Promise<UnloadRateRow[]> {
  await requireAdmin();
  return listUnloadRates();
}

export async function getUnloadRatesMatrix() {
  await requireAdmin();
  return listUnloadRatesMatrix();
}

export async function saveUnloadRates(input: {
  rates: {
    marketCode: string;
    crateType: string;
    rateMyr: number;
    notes?: string | null;
  }[];
}): Promise<UnloadRateRow[]> {
  await requireAdmin();
  const rates = await saveUnloadRatesBatch(input.rates);
  revalidatePath("/settings");
  revalidatePath("/operations");
  return rates;
}
