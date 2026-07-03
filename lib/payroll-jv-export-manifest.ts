/**
 * Payroll JV export manifest — tracks active vs voided CSV generations.
 * JV CSVs are not stored in DB; this file prevents old/new export confusion.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

export type PayrollJvExportStatus = "active" | "void";

export interface PayrollJvExportManifestEntry {
  yearMonth: string;
  filename: string;
  status: PayrollJvExportStatus;
  revision: number;
  driverCount: number;
  exportedAt: string;
  voidReason?: string;
  voidedAt?: string;
  supersededBy?: string;
  notes?: string;
}

export interface PayrollJvExportManifest {
  entries: PayrollJvExportManifestEntry[];
}

export const PAYROLL_JV_MANIFEST_PATH = path.join(
  process.cwd(),
  "scripts",
  "_output",
  "payroll-jv",
  "manifest.json"
);

export function readPayrollJvManifest(): PayrollJvExportManifest {
  if (!existsSync(PAYROLL_JV_MANIFEST_PATH)) {
    return { entries: [] };
  }
  const raw = readFileSync(PAYROLL_JV_MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as PayrollJvExportManifest;
}

export function writePayrollJvManifest(manifest: PayrollJvExportManifest) {
  const dir = path.dirname(PAYROLL_JV_MANIFEST_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(PAYROLL_JV_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function voidPayrollJvExport(input: {
  yearMonth: string;
  filename: string;
  voidReason: string;
  supersededBy: string;
  notes?: string;
}) {
  const manifest = readPayrollJvManifest();
  const now = new Date().toISOString();
  for (const entry of manifest.entries) {
    if (
      entry.yearMonth === input.yearMonth &&
      entry.filename === input.filename &&
      entry.status === "active"
    ) {
      entry.status = "void";
      entry.voidReason = input.voidReason;
      entry.voidedAt = now;
      entry.supersededBy = input.supersededBy;
      if (input.notes) entry.notes = input.notes;
    }
  }
  writePayrollJvManifest(manifest);
}

export function registerPayrollJvExport(entry: Omit<PayrollJvExportManifestEntry, "exportedAt">) {
  const manifest = readPayrollJvManifest();
  manifest.entries.push({
    ...entry,
    exportedAt: new Date().toISOString(),
  });
  writePayrollJvManifest(manifest);
}

export function payrollJvOutputPath(filename: string) {
  return path.join(process.cwd(), "scripts", "_output", "payroll-jv", filename);
}
