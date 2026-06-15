import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  for (const q of ["B53", "F56", "G36", "IS14", "MC65", "IS17", "TT", "AH BENG"]) {
    const stalls = await prisma.stall.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { market: true, consignee: true },
    });
    console.log(
      q,
      stalls.map((s) => ({
        code: s.code,
        name: s.name,
        market: s.market?.code,
        consignee: s.consignee?.code,
      }))
    );
  }
}

main().finally(() => prisma.$disconnect());
