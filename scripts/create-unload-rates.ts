import "dotenv/config";
import { createUnloadRatesTable } from "../lib/create-unload-rates-table";
import { listUnloadRates } from "../lib/unload-rates-service";

async function main() {
  await createUnloadRatesTable();
  const rates = await listUnloadRates();
  console.log(
    JSON.stringify(
      {
        ok: true,
        count: rates.length,
        message: "unload_rates table created and seeded",
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
