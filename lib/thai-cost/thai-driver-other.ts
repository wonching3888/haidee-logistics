import { prisma } from "@/lib/prisma";
import { THAI_DRIVER_OTHER_NAME } from "@/lib/thai-cost/thai-vehicle-pnl-constants";

/** Ensure sentinel「其他」driver exists (baseWage 0). Not a RENTED: notes marker. */
export async function ensureThaiOtherDriver(): Promise<string> {
  const row = await prisma.thaiDriver.upsert({
    where: { name: THAI_DRIVER_OTHER_NAME },
    create: {
      name: THAI_DRIVER_OTHER_NAME,
      baseWage: 0,
      active: true,
    },
    update: { active: true, baseWage: 0 },
    select: { id: true },
  });
  return row.id;
}
