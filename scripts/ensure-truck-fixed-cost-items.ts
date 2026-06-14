import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  FIXED_TRUCK_COST_ITEM_NAMES,
  loadTruckCostItems,
  prepareTruckCostItemsForSave,
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
    const current = truck.costItems.map((item) => ({
      name: item.name,
      annualAmount: Number(item.annualAmount),
    }));
    const prepared = prepareTruckCostItemsForSave(current);
    const loaded = loadTruckCostItems(current);

    const needsUpdate =
      current.length !== prepared.length ||
      prepared.some((item, index) => {
        const existing = truck.costItems[index];
        return (
          !existing ||
          existing.name !== item.name ||
          Number(existing.annualAmount) !== item.annualAmount
        );
      });

    if (!needsUpdate) continue;

    await prisma.$transaction(async (tx) => {
      await tx.truckCostItem.deleteMany({ where: { truckId: truck.id } });
      await tx.truckCostItem.createMany({
        data: prepared.map((item, index) => ({
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
        before: current.length,
        after: prepared.length,
        fixed: FIXED_TRUCK_COST_ITEM_NAMES.length,
        custom: prepared.length - FIXED_TRUCK_COST_ITEM_NAMES.length,
        items: loaded,
      })
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        trucksProcessed: trucks.length,
        trucksUpdated: updatedTrucks,
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
