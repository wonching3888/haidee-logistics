/**
 * Seed Thai route_masters (SONGKHLA/PATTANI) + 4 TH trucks (needs_review costs).
 * Run: npx tsx --env-file=.env.local scripts/_seed-thai-routes-and-trucks.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { defaultCostItemsForCountry } from "../lib/constants/truck-cost";
import { prisma } from "../lib/prisma";

const ROUTES = [
  {
    code: "SONGKHLA",
    name: "宋卡路线",
    markets: ["SONGKHLA"],
    sadooMileageKm: 180,
    displayOrder: 100,
  },
  {
    code: "PATTANI",
    name: "北大年路线",
    markets: ["PATTANI"],
    sadooMileageKm: 280,
    displayOrder: 101,
  },
] as const;

const TH_TRUCKS = ["72-3353", "72-3338", "72-3869", "70-9522"] as const;

async function main() {
  for (const r of ROUTES) {
    const existing = await prisma.routeMaster.findUnique({
      where: { code: r.code },
    });
    const data = {
      name: r.name,
      markets: [...r.markets],
      sadooMileageKm: r.sadooMileageKm,
      tollFee: 0,
      tollFeeClass2: 0,
      tollFeeClass3: 0,
      fishCheckingFee: 0,
      parkingFee: 0,
      displayOrder: r.displayOrder,
      active: true,
    };
    if (existing) {
      await prisma.routeMaster.update({ where: { id: existing.id }, data });
      console.log(`ROUTE UPDATE ${r.code} mileage=${r.sadooMileageKm}`);
    } else {
      await prisma.routeMaster.create({
        data: { id: randomUUID(), code: r.code, ...data },
      });
      console.log(`ROUTE CREATE ${r.code} mileage=${r.sadooMileageKm}`);
    }
  }

  for (const plate of TH_TRUCKS) {
    const existing = await prisma.truck.findUnique({ where: { plate } });
    if (existing) {
      await prisma.truck.update({
        where: { id: existing.id },
        data: {
          country: "TH",
          active: true,
          // leave efficiency / annual mileage null = needs_review
          fuelEfficiencyKmPerL: null,
          annualMileageKm: null,
        },
      });
      const items = await prisma.truckCostItem.findMany({
        where: { truckId: existing.id },
      });
      if (items.length === 0) {
        for (const item of defaultCostItemsForCountry("TH")) {
          await prisma.truckCostItem.create({
            data: {
              id: randomUUID(),
              truckId: existing.id,
              name: item.name,
              annualAmount: 0,
              sortOrder: item.sortOrder,
            },
          });
        }
      }
      console.log(`TRUCK UPDATE ${plate} country=TH needs_review`);
    } else {
      const id = randomUUID();
      await prisma.truck.create({
        data: {
          id,
          plate,
          type: "big",
          country: "TH",
          tollClass: "class3",
          fuelEfficiencyKmPerL: null,
          annualMileageKm: null,
          active: true,
          costItems: {
            create: defaultCostItemsForCountry("TH").map((item) => ({
              id: randomUUID(),
              name: item.name,
              annualAmount: 0,
              sortOrder: item.sortOrder,
            })),
          },
        },
      });
      console.log(`TRUCK CREATE ${plate} country=TH needs_review`);
    }
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
