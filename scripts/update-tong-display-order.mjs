import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "..", "prisma", "update-tong-display-order.sql");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const statements = readFileSync(sqlPath, "utf8")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  const count = await prisma.$executeRawUnsafe(`${statement};`);
  console.log(`  ✓ ${count} row(s) — ${statement.split("\n")[0]}`);
}

await prisma.$disconnect();
