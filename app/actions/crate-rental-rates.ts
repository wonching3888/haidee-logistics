"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  listCrateRentalRates,
  saveCrateRentalRatesBatch,
  type CrateRentalRateRow,
} from "@/lib/crate-rental-rates-service";
import type { CrateRentalCurrency } from "@/lib/crate-rental-cost";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getCrateRentalRates(): Promise<CrateRentalRateRow[]> {
  await requireAdmin();
  return listCrateRentalRates();
}

export async function saveCrateRentalRates(input: {
  rates: {
    crateType: string;
    isRental: boolean;
    rate: number;
    currency: CrateRentalCurrency;
    notes?: string | null;
  }[];
}): Promise<CrateRentalRateRow[]> {
  await requireAdmin();
  const rates = await saveCrateRentalRatesBatch(input.rates);
  revalidatePath("/settings");
  revalidatePath("/reports/crate-rental");
  return rates;
}
