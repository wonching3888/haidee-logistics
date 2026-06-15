import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DRIVER_ROWS = [
  { nickname: "Halim", full_name: "Abdul Halim Bin Ahmad", ic_number: "920423-02-5747", bank_name: "CIMB", bank_account: "705-806-8978", epf_number: "18874734", socso_number: "920423025747", tin_number: "IG24766536030", children_count: 2, phone: "0195056826", marital_status: "married" },
  { nickname: "Awang", full_name: "Sharif Bin Mat", ic_number: "731127-02-5993", bank_name: "HLBB", bank_account: "0315-1216-472", epf_number: "12805588", socso_number: "731127025993", tin_number: "IG53883187010", children_count: 2, phone: "01115274050", marital_status: "married" },
  { nickname: "Azrin", full_name: "Mohd Azrin Bin Mohd Sadri", ic_number: "870708-02-5529", bank_name: "Maybank", bank_account: "1520-9572-6872", epf_number: "17091372", socso_number: "870708025529", tin_number: "IG55274074080", children_count: 4, phone: "0133751430", marital_status: "married" },
  { nickname: "Wan", full_name: "Mustafa", ic_number: "870331-29-5157", bank_name: "Maybank", bank_account: "1051-3013-1330", epf_number: "16977592", socso_number: "870331295157", tin_number: "IG40431418100", children_count: 4, phone: "0183676235", marital_status: "married" },
  { nickname: "Own", full_name: "Muhammad Asrul Bin Abdul Jalil", ic_number: "780528-02-5653", bank_name: "PBB", bank_account: "780528025653", epf_number: "13886068", socso_number: "780528025653", tin_number: "IG25122467080", children_count: 1, phone: "01135315653", marital_status: "married" },
  { nickname: "Rozaime", full_name: "Rozaime Bin Othman", ic_number: "930703-09-5095", bank_name: "Maybank", bank_account: "1590-1304-6787", epf_number: "19379569", socso_number: "930703095095", tin_number: "IG57295761000", children_count: 4, phone: "01123460878", marital_status: "married" },
  { nickname: "Fook", full_name: "Yong Ah Fook", ic_number: "640421-02-5309", bank_name: "Maybank", bank_account: "1522-1905-8650", epf_number: "12798115", socso_number: "640421025309", tin_number: "IG5425518100", children_count: 0, phone: "0173461171", marital_status: "single" },
  { nickname: "Faizal", full_name: "Ku Mohd Faizal Bin Ku Aziz", ic_number: "810824-02-5791", bank_name: "Maybank", bank_account: "1520-6882-8445", epf_number: "15091618", socso_number: "810824025791", tin_number: "IG22158103000", children_count: 3, phone: "0194755791", marital_status: "married" },
  { nickname: "Akim", full_name: "Muhammad Hakim Bin Mat Sarip", ic_number: "971108-02-5333", bank_name: "PBB", bank_account: "692-986-8521", epf_number: "22977010", socso_number: "971108025333", tin_number: "IG29508534070", children_count: 2, phone: "0194932482", marital_status: "married" },
  { nickname: "Naim", full_name: "Mohamad Naim Bin Zulkefli", ic_number: "980618-09-5053", bank_name: "Maybank", bank_account: "5590-1234-8321", epf_number: "22655742", socso_number: "980618095053", tin_number: "IG29052842090", children_count: 0, phone: "0183124379", marital_status: "single" },
  { nickname: "Azhar", full_name: "Norazhar Bin Baharom", ic_number: "810927-09-5047", bank_name: "CIMB", bank_account: "860-333-8501", epf_number: "17149154", socso_number: "810927095047", tin_number: "IG11679262000", children_count: 3, phone: "01157340874", marital_status: "married" },
  { nickname: "Pinat", full_name: "Mohd Shafinar Bin Abdullah", ic_number: "850527-02-5089", bank_name: "PBB", bank_account: "681-324-2001", epf_number: "19046951", socso_number: "850527025089", tin_number: "IG54845144030", children_count: 3, phone: "0194957530", marital_status: "married" },
  { nickname: "Din", full_name: "Khairuddin Bin Hashim", ic_number: "890518-02-5745", bank_name: "Maybank", bank_account: "1522-1911-0535", epf_number: "17697105", socso_number: "890518025745", tin_number: "IG26679143030", children_count: 0, phone: "0132865539", marital_status: "single" },
  { nickname: "Ikmal", full_name: "Mohd Ikmal Hisham Bin Hanapi", ic_number: "890628-02-5885", bank_name: "PBB", bank_account: "686-873-0423", epf_number: "17814248", socso_number: "890628025885", tin_number: "IG25668552050", children_count: 2, phone: "0103872159", marital_status: "married" },
] as const;

const VALID_IC_NUMBERS = DRIVER_ROWS.map((row) => row.ic_number);

function mapBankName(value: string) {
  const trimmed = value.trim();
  if (trimmed.toUpperCase() === "K") return "Maybank";
  return trimmed;
}

async function getColumnNames(table: string) {
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'
     ORDER BY ordinal_position`
  );
  return new Set(cols.map((col) => col.column_name));
}

async function ensureDriverColumns() {
  const columns = await getColumnNames("drivers");
  const alters: string[] = [];

  if (!columns.has("nickname")) {
    alters.push("ADD COLUMN nickname text");
  }
  if (!columns.has("bank_name")) {
    alters.push("ADD COLUMN bank_name text");
  }
  if (!columns.has("bank_account")) {
    alters.push("ADD COLUMN bank_account text");
  }

  if (alters.length > 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE drivers ${alters.join(", ")}`
    );
    console.log(`Added columns: ${alters.join(", ")}`);
  } else {
    console.log("Driver columns nickname, bank_name, bank_account already exist");
  }
}

async function ensureIcNumberUniqueIndex() {
  const indexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'drivers'
       AND indexdef ILIKE '%ic_number%'`
  );

  if (indexes.some((row) => row.indexname.includes("ic_number"))) {
    console.log("ic_number unique index already exists");
    return;
  }

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX drivers_ic_number_key ON drivers (ic_number) WHERE ic_number IS NOT NULL`
  );
  console.log("Created unique index drivers_ic_number_key on ic_number");
}

function nicknameVariants(nickname: string) {
  return Array.from(
    new Set([nickname, nickname.toUpperCase(), nickname.toLowerCase()])
  );
}

async function findDriversForRow(row: (typeof DRIVER_ROWS)[number]) {
  const variants = nicknameVariants(row.nickname);
  return prisma.driver.findMany({
    where: {
      OR: [
        { icNumber: row.ic_number },
        ...variants.flatMap((variant) => [
          { name: { equals: variant, mode: "insensitive" as const } },
          { nickname: { equals: variant, mode: "insensitive" as const } },
        ]),
      ],
    },
    select: { id: true, name: true, icNumber: true },
  });
}

async function mergeDriverReferences(fromId: string, toId: string) {
  if (fromId === toId) return;

  await prisma.truck.updateMany({
    where: { defaultDriverId: fromId },
    data: { defaultDriverId: toId },
  });

  const payrollMonths = await prisma.driverPayrollMonth.findMany({
    where: { driverId: fromId },
    select: { id: true, yearMonth: true },
  });

  for (const month of payrollMonths) {
    const conflict = await prisma.driverPayrollMonth.findUnique({
      where: {
        driverId_yearMonth: { driverId: toId, yearMonth: month.yearMonth },
      },
    });

    if (conflict) {
      await prisma.driverPayrollTrip.updateMany({
        where: { payrollMonthId: month.id },
        data: { payrollMonthId: conflict.id },
      });
      await prisma.driverPayrollExtra.updateMany({
        where: { payrollMonthId: month.id },
        data: { payrollMonthId: conflict.id },
      });
      await prisma.driverPayrollMonth.delete({ where: { id: month.id } });
      continue;
    }

    await prisma.driverPayrollMonth.update({
      where: { id: month.id },
      data: { driverId: toId },
    });
  }
}

async function upsertDriverRow(row: (typeof DRIVER_ROWS)[number]) {
  const matches = await findDriversForRow(row);
  const byIc = matches.find((driver) => driver.icNumber === row.ic_number);
  const primaryId = byIc?.id ?? matches[0]?.id;

  for (const match of matches) {
    if (primaryId && match.id !== primaryId) {
      await mergeDriverReferences(match.id, primaryId);
      await prisma.driver.delete({ where: { id: match.id } });
      console.log(`  merged duplicate ${match.name} (${match.id}) → ${primaryId}`);
    }
  }

  const data = {
    name: row.nickname,
    nickname: row.nickname,
    fullName: row.full_name,
    icNumber: row.ic_number,
    bankName: mapBankName(row.bank_name),
    bankAccount: row.bank_account,
    epfNumber: row.epf_number,
    socsoNumber: row.socso_number,
    maritalStatus: row.marital_status,
    childCount: row.children_count,
    active: true,
  };

  if (primaryId) {
    await prisma.driver.update({
      where: { id: primaryId },
      data,
    });
    return "updated" as const;
  }

  await prisma.driver.create({ data });
  return "inserted" as const;
}

async function deleteExtraDrivers() {
  const extras = await prisma.driver.findMany({
    where: {
      OR: [
        { icNumber: null },
        { icNumber: { notIn: [...VALID_IC_NUMBERS] } },
      ],
    },
    select: { id: true, name: true, icNumber: true },
  });

  let deleted = 0;
  for (const driver of extras) {
    const trucks = await prisma.truck.count({
      where: { defaultDriverId: driver.id },
    });
    const payroll = await prisma.driverPayrollMonth.count({
      where: { driverId: driver.id },
    });
    if (trucks > 0 || payroll > 0) {
      console.warn(
        `  skip delete ${driver.name} — still has trucks=${trucks} payroll=${payroll}`
      );
      continue;
    }
    await prisma.driver.delete({ where: { id: driver.id } });
    console.log(`  deleted extra driver ${driver.name} (${driver.icNumber ?? "no ic"})`);
    deleted += 1;
  }
  return deleted;
}

async function main() {
  console.log("=== Step 1: ensure driver columns ===");
  await ensureDriverColumns();

  console.log("\n=== Step 2: dedupe and upsert by ic_number ===");
  let inserted = 0;
  let updated = 0;

  for (const row of DRIVER_ROWS) {
    const result = await upsertDriverRow(row);
    if (result === "inserted") inserted += 1;
    else updated += 1;
    console.log(`  ${result}: ${row.nickname} (${row.ic_number})`);
  }

  console.log("\n=== Step 3: ensure ic_number unique index ===");
  await ensureIcNumberUniqueIndex();

  console.log("\n=== Step 4: delete extra drivers ===");
  const deleted = await deleteExtraDrivers();

  const total = await prisma.driver.count();
  const drivers = await prisma.driver.findMany({
    orderBy: { nickname: "asc" },
    select: {
      name: true,
      nickname: true,
      fullName: true,
      icNumber: true,
      bankName: true,
      bankAccount: true,
    },
  });

  console.log("\n=== Results ===");
  console.log(`inserted=${inserted}, updated=${updated}, deleted=${deleted}`);
  console.log(`final drivers count: ${total}`);
  console.log("\n=== Final drivers ===");
  for (const driver of drivers) {
    console.log(
      JSON.stringify({
        nickname: driver.nickname,
        name: driver.name,
        fullName: driver.fullName,
        ic: driver.icNumber,
        bank: driver.bankName,
        account: driver.bankAccount,
      })
    );
  }

  if (total !== DRIVER_ROWS.length) {
    throw new Error(
      `Expected ${DRIVER_ROWS.length} drivers after fix, got ${total}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
