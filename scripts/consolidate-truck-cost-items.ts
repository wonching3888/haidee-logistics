import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  FIXED_TRUCK_COST_ITEM_NAMES,
  consolidateTruckCostItems,
} from "../lib/constants/truck-cost";

async function main() {
  const trucks = await prisma.truck.findMany({
    include: {
      costItems: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { plate: "asc" },
  });

  let updatedTrucks = 0;

  for (const truck of trucks) {
    const consolidated = consolidateTruckCostItems(
      truck.costItems.map((item) => ({
        name: item.name,
        annualAmount: Number(item.annualAmount),
      }))
    );

    await prisma.$transaction(async (tx) => {
      await tx.truckCostItem.deleteMany({ where: { truckId: truck.id } });
      await tx.truckCostItem.createMany({
        data: consolidated.map((item, index) => ({
          truckId: truck.id,
          name: item.name,
          annualAmount: item.annualAmount,
          sortOrder: index,
        })),
      });
    });

    updatedTrucks += 1;
    console.log(
      JSON.stringify({
        plate: truck.plate,
        before: truck.costItems.length,
        after: FIXED_TRUCK_COST_ITEM_NAMES.length,
        items: consolidated,
      })
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        trucksProcessed: updatedTrucks,
        fixedItemNames: FIXED_TRUCK_COST_ITEM_NAMES,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
