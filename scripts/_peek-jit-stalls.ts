import "dotenv/config";
import { prisma } from "@/lib/prisma";

const codes = [
  "3002-S003", "3002-L004", "3002-N001", "3002-R001", "3002-S001", "3002-H001",
  "3002-N002", "3002-F003",
];

async function main() {
  for (const code of codes) {
    const c = await prisma.consignee.findUnique({ where: { code } });
    console.log(code, c?.name);
    if (!c) continue;
    const stalls = await prisma.stall.findMany({
      where: {
        OR: [
          { consigneeId: c.id },
          { name: { contains: c.name.split(" - ")[0], mode: "insensitive" } },
        ],
      },
      include: { market: true },
    });
    console.log(
      "  stalls:",
      stalls.map((s) => `${s.market?.code} ${s.code}`)
    );
  }

  for (const stallCode of ["A53", "B39", "D46", "F49", "A43", "BM45", "F40", "A56"]) {
    const stalls = await prisma.stall.findMany({
      where: { code: stallCode },
      include: { market: true },
    });
    console.log("stall", stallCode, stalls.map((s) => s.market?.code));
  }
}

main().finally(() => prisma.$disconnect());
