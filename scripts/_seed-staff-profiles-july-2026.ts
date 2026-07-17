/**
 * Seed 5 WTL Express office staff profile records (identity + bank + statutory registration only).
 * Salary, marital status, spouse-working status intentionally left blank — to be filled in by
 * the accountant via Settings → Staff.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_seed-staff-profiles-july-2026.ts
 */
import { prisma } from "@/lib/prisma";

const STAFF = [
  {
    name: "Chew Siew Leng",
    nickname: "Chew",
    icNumber: "750909-07-5358",
    bankName: "PBB",
    bankAccount: "456-277-5015",
    epfNumber: "13246713",
    socsoNumber: "750909075358",
    tinNumber: "IG10726770050",
    phoneNumber: "+6019-462 2854",
    childCount: 0,
    startDate: new Date("2024-09-01"),
    accountCodeSuffix: "CHEW",
    payrollCategory: "salary",
  },
  {
    name: "Lor Won Ching",
    nickname: "Lor",
    icNumber: "850923-02-5929",
    bankName: "HLBB",
    bankAccount: "229-501-29060",
    epfNumber: "15806318",
    socsoNumber: "850923025929",
    tinNumber: "IG20055527080",
    phoneNumber: "+6011-3335 5530",
    childCount: 0,
    startDate: new Date("2022-06-01"),
    accountCodeSuffix: "LWC1",
    payrollCategory: "director_remuneration",
  },
  {
    name: "Teoh Boon Teong",
    nickname: "Teoh",
    icNumber: "840215-07-5117",
    bankName: "MAYBANK",
    bankAccount: "1573-4411-5485",
    epfNumber: "21587636",
    socsoNumber: "840215075117",
    tinNumber: "IG21885470060",
    phoneNumber: "+6017-420 1152",
    childCount: 2,
    startDate: new Date("2024-07-01"),
    accountCodeSuffix: "TEOH",
    payrollCategory: "salary",
  },
  {
    name: "Wong Suan Fong",
    nickname: "Wong",
    icNumber: "730721-02-5078",
    bankName: "PBB",
    bankAccount: "313-215-7729",
    epfNumber: "14682832",
    socsoNumber: "730721025078",
    tinNumber: "IG6305107091",
    phoneNumber: "+6012-405 9014",
    childCount: 0,
    startDate: new Date("2024-07-01"),
    accountCodeSuffix: "WSF1",
    payrollCategory: "director_remuneration",
  },
  {
    name: "Heah Kooi Sim",
    nickname: "Heah",
    icNumber: "791003-07-5096",
    bankName: "RHB",
    bankAccount: "1571-0800-0616-78",
    epfNumber: "15317259",
    socsoNumber: "791003075096",
    tinNumber: "IG20056150020",
    phoneNumber: "+6012-594 4284",
    childCount: 2,
    startDate: new Date("2022-06-01"),
    accountCodeSuffix: "HEAH",
    payrollCategory: "director_remuneration",
  },
] as const;

async function main() {
  for (const s of STAFF) {
    const existing = await prisma.staff.findUnique({ where: { name: s.name } });
    if (existing) {
      console.log(`SKIP (already exists): ${s.name}`);
      continue;
    }
    const created = await prisma.staff.create({
      data: {
        name: s.name,
        nickname: s.nickname,
        icNumber: s.icNumber,
        bankName: s.bankName,
        bankAccount: s.bankAccount,
        epfNumber: s.epfNumber,
        socsoNumber: s.socsoNumber,
        tinNumber: s.tinNumber,
        phoneNumber: s.phoneNumber,
        childCount: s.childCount,
        startDate: s.startDate,
        accountCodeSuffix: s.accountCodeSuffix,
        payrollCategory: s.payrollCategory,
        // baseSalary / maritalStatus / spouseWorking 刻意留空，交给会计在 Settings 填
        // pcbNeedsReview 保持默认 true
      },
    });
    console.log(`CREATED: ${s.name} (${created.id})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
