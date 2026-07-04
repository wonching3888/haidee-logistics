import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";

const tables = [
  "thai_monthly_workers",
  "thai_daily_labor_attendance",
  "thai_drivers",
  "sadao_crate_handling_daily",
];

async function main() {
  const cols = await prisma.$queryRawUnsafe<
    Array<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>
  >(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
     ORDER BY table_name, ordinal_position`,
    tables
  );

  for (const t of tables) {
    console.log(`\n## ${t}`);
    for (const c of cols.filter((r) => r.table_name === t)) {
      console.log(
        `  ${c.column_name.padEnd(28)} ${c.data_type.padEnd(20)} ${
          c.is_nullable === "YES" ? "NULL" : "NOT NULL"
        }`
      );
    }
  }

  const workers = await prisma.thaiMonthlyWorker.findMany({
    orderBy: { name: "asc" },
  });
  console.log("\n## thai_monthly_workers rows");
  for (const w of workers) {
    console.log(
      `  ${w.name} | ${w.station} | ${w.monthlyWage} | active=${w.active}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
