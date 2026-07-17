/**
 * One-shot: fill baseSalary / marital / spouseWorking for 5 WTL staff (July 2026).
 * Run: node --env-file=.env.local --import tsx scripts/_apply-staff-master-july-2026.ts
 */
import {
  derivePcbNeedsReview,
  normalizeSpouseWorking,
} from "@/lib/driver-pcb-profile";
import { prisma } from "@/lib/prisma";

const UPDATES = [
  {
    name: "Chew Siew Leng",
    baseSalary: 3100,
    maritalStatus: "married",
    spouseWorking: true as boolean | null,
  },
  {
    name: "Lor Won Ching",
    baseSalary: 8500,
    maritalStatus: "single",
    spouseWorking: null as boolean | null,
  },
  {
    name: "Teoh Boon Teong",
    baseSalary: 2000,
    maritalStatus: "married",
    spouseWorking: true as boolean | null,
  },
  {
    name: "Wong Suan Fong",
    baseSalary: 8500,
    maritalStatus: "married",
    spouseWorking: true as boolean | null,
  },
  {
    name: "Heah Kooi Sim",
    baseSalary: 8500,
    maritalStatus: "single",
    spouseWorking: null as boolean | null,
  },
] as const;

async function main() {
  for (const row of UPDATES) {
    const spouseWorking = normalizeSpouseWorking({
      maritalStatus: row.maritalStatus,
      spouseWorking: row.spouseWorking,
    });
    const pcbNeedsReview = derivePcbNeedsReview({
      maritalStatus: row.maritalStatus,
      spouseWorking,
    });
    const updated = await prisma.staff.update({
      where: { name: row.name },
      data: {
        baseSalary: row.baseSalary,
        maritalStatus: row.maritalStatus,
        spouseWorking,
        pcbNeedsReview,
      },
    });
    console.log(
      `UPDATED: ${updated.name} salary=${updated.baseSalary} marital=${updated.maritalStatus} spouse=${updated.spouseWorking} pcbReview=${updated.pcbNeedsReview}`
    );
  }

  const all = await prisma.staff.findMany({ orderBy: { name: "asc" } });
  console.log("\n=== staff table ===");
  console.log("count=", all.length);
  for (const s of all) {
    console.log(
      JSON.stringify({
        name: s.name,
        baseSalary: s.baseSalary?.toString() ?? null,
        maritalStatus: s.maritalStatus,
        spouseWorking: s.spouseWorking,
        pcbNeedsReview: s.pcbNeedsReview,
        childCount: s.childCount,
        payrollCategory: s.payrollCategory,
        accountCodeSuffix: s.accountCodeSuffix,
      })
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
