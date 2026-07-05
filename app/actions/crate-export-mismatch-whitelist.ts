"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  addCrateExportMismatchWhitelistEntry,
  listCrateExportMismatchWhitelist,
  removeCrateExportMismatchWhitelistEntry,
} from "@/lib/crate-export-mismatch-whitelist-service";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getCrateExportMismatchWhitelistData() {
  await requireAdmin();
  return listCrateExportMismatchWhitelist();
}

export async function saveCrateExportMismatchWhitelistEntry(input: {
  shipperId: string;
  note?: string;
}) {
  const user = await requireAdmin();
  await addCrateExportMismatchWhitelistEntry({
    shipperId: input.shipperId,
    note: input.note,
    createdById: user.id,
  });
  revalidatePath("/settings");
  revalidatePath("/crate/export");
}

export async function deleteCrateExportMismatchWhitelistEntry(shipperId: string) {
  await requireAdmin();
  await removeCrateExportMismatchWhitelistEntry(shipperId);
  revalidatePath("/settings");
  revalidatePath("/crate/export");
}
