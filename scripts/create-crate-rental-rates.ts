import "dotenv/config";
import { createCrateRentalRatesTable } from "../lib/create-crate-rental-rates-table";
import { listCrateRentalRates } from "../lib/crate-rental-rates-service";

async function main() {
  await createCrateRentalRatesTable();
  const rates = await listCrateRentalRates();
  console.log(
    JSON.stringify(
      {
        ok: true,
        count: rates.length,
        message: "crate_rental_rates table created and seeded",
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
