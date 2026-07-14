/**
 * Set THB cash-book opening balance (audited adjustment row).
 * Notes document as-of date — schema has no effectiveDate column.
 */
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";

config({ path: ".env.local" });

async function main() {
  const book = "THB";
  const newAmount = 219073;
  const notes =
    "2026-06-30 起算（7月历史账导入前）/ Opening as of 2026-06-30 before July historical import";
  const admin = await prisma.user.findFirst({
    where: { email: "admin@haideelogistics.com" },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error("no admin");
  const latest = await prisma.cashBookOpeningBalanceAdjustment.findFirst({
    where: { book },
    orderBy: { createdAt: "desc" },
  });
  const previousAmount = latest ? Number(latest.newAmount) : 0;
  if (previousAmount === newAmount) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason: "already set",
        previousAmount,
        notes: latest?.notes,
      })
    );
    await prisma.$disconnect();
    return;
  }
  const row = await prisma.cashBookOpeningBalanceAdjustment.create({
    data: {
      id: randomUUID(),
      book,
      previousAmount,
      newAmount,
      notes,
      createdBy: admin.id,
    },
  });
  console.log(
    JSON.stringify(
      {
        created: true,
        id: row.id,
        previousAmount,
        newAmount: Number(row.newAmount),
        notes: row.notes,
        createdBy: admin.email,
        createdAt: row.createdAt.toISOString(),
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
