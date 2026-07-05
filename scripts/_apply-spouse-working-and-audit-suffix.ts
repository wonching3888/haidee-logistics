/**
 * Task 1: write spouseWorking for 11 married drivers (same logic as saveDriverPayrollMaster).
 * Task 2: read-only audit of accountCodeSuffix for 14 drivers.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_apply-spouse-working-and-audit-suffix.ts
 */
import {
  derivePcbNeedsReview,
  normalizeSpouseWorking,
} from "@/lib/driver-pcb-profile";
import { prisma } from "@/lib/prisma";

const SPOUSE_WORKING: Record<string, boolean> = {
  Akim: true,
  Azhar: true,
  Awang: false,
  Azrin: false,
  Faizal: false,
  Halim: false,
  Ikmal: false,
  Own: false,
  Pinat: false,
  Rozaime: false,
  Wan: false,
};

const MEMO_SUFFIX: Record<string, string> = {
  Halim: "HLIM",
  Awang: "WANG",
  Azrin: "PEIN",
  Wan: "WAN1",
  Own: "OWN1",
  Rozaime: "ROZA",
  Fook: "FOOK",
  Faizal: "FAIZ",
  Akim: "AKIM",
  Naim: "NAIM",
  Azhar: "AZAR",
  Pinat: "PNAT",
  Din: "DIN1",
  Ikmal: "IMAL",
};

const ALL_14 = Object.keys(MEMO_SUFFIX);

async function applySpouseWorking() {
  console.log("=== Task 1: write spouseWorking (Settings save-path logic) ===\n");

  for (const [name, spouseWorking] of Object.entries(SPOUSE_WORKING)) {
    const driver = await prisma.driver.findFirst({
      where: { name },
      select: {
        id: true,
        name: true,
        maritalStatus: true,
        spouseWorking: true,
        pcbNeedsReview: true,
      },
    });
    if (!driver) throw new Error(`Driver not found: ${name}`);
    if (driver.maritalStatus !== "married") {
      throw new Error(`${name} maritalStatus=${driver.maritalStatus}, expected married`);
    }

    const normalized = normalizeSpouseWorking({
      maritalStatus: driver.maritalStatus,
      spouseWorking,
    });
    const pcbNeedsReview = derivePcbNeedsReview({
      maritalStatus: driver.maritalStatus,
      spouseWorking: normalized,
    });

    await prisma.driver.update({
      where: { id: driver.id },
      data: {
        spouseWorking: normalized,
        pcbNeedsReview,
      },
    });

    console.log(
      `${name}: spouseWorking ${driver.spouseWorking === null ? "NULL" : driver.spouseWorking} → ${normalized} | pcbNeedsReview ${driver.pcbNeedsReview} → ${pcbNeedsReview}`
    );
  }
}

async function reportProfiles() {
  console.log("\n=== Task 1: 14-driver PCB profile status ===\n");

  const drivers = await prisma.driver.findMany({
    where: { name: { in: ALL_14 } },
    select: {
      name: true,
      maritalStatus: true,
      spouseWorking: true,
      pcbNeedsReview: true,
      childCount: true,
    },
    orderBy: { name: "asc" },
  });

  let complete = 0;
  for (const d of drivers) {
    const derived = derivePcbNeedsReview({
      maritalStatus: d.maritalStatus,
      spouseWorking: d.spouseWorking,
    });
    const ok =
      !derived &&
      d.pcbNeedsReview === false &&
      (d.maritalStatus === "single" ||
        (d.maritalStatus === "married" && d.spouseWorking != null));
    if (ok) complete++;
    console.log(
      [
        d.name.padEnd(10),
        `marital=${d.maritalStatus ?? "NULL"}`.padEnd(18),
        `spouse=${d.spouseWorking === null ? "NULL" : d.spouseWorking}`.padEnd(14),
        `pcbNeedsReview=${d.pcbNeedsReview}`,
        `derived=${derived}`,
        ok ? "齐全" : "未齐",
      ].join("  ")
    );
  }

  console.log(`\n齐全: ${complete}/${drivers.length}`);
  if (complete !== 14) {
    throw new Error(`Expected all 14 profiles complete, got ${complete}`);
  }
}

async function auditSuffixes() {
  console.log("\n=== Task 2: accountCodeSuffix audit (read-only) ===\n");

  const drivers = await prisma.driver.findMany({
    where: { name: { in: ALL_14 } },
    select: {
      name: true,
      accountCodeSuffix: true,
      autoCountEmployeeCode: true,
    },
    orderBy: { name: "asc" },
  });

  const byName = new Map(drivers.map((d) => [d.name, d]));
  const match: string[] = [];
  const missing: string[] = [];
  const mismatch: string[] = [];

  console.log(
    "name".padEnd(10),
    "DB suffix".padEnd(12),
    "memo".padEnd(8),
    "status"
  );

  for (const name of ALL_14.sort()) {
    const d = byName.get(name);
    const memo = MEMO_SUFFIX[name]!;
    const actual = d?.accountCodeSuffix ?? null;
    let status: string;
    if (actual == null || actual === "") {
      status = "MISSING";
      missing.push(name);
    } else if (actual === memo) {
      status = "OK";
      match.push(name);
    } else {
      status = `MISMATCH (DB=${actual})`;
      mismatch.push(`${name}: DB=${actual} memo=${memo}`);
    }
    console.log(
      name.padEnd(10),
      (actual ?? "NULL").padEnd(12),
      memo.padEnd(8),
      status
    );
  }

  console.log(`\nOK: ${match.length}`);
  console.log(`Missing: ${missing.length}${missing.length ? " — " + missing.join(", ") : ""}`);
  console.log(
    `Mismatch: ${mismatch.length}${mismatch.length ? "\n  " + mismatch.join("\n  ") : ""}`
  );

  const din = byName.get("Din");
  console.log(
    `\nDin DIN1 check: accountCodeSuffix=${din?.accountCodeSuffix ?? "NULL"} (memo=DIN1) → ${din?.accountCodeSuffix === "DIN1" ? "OK" : "NOT OK"}`
  );
}

async function main() {
  await applySpouseWorking();
  await reportProfiles();
  await auditSuffixes();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
