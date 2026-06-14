import "dotenv/config";
import { createGlobalCostSettingsTable } from "../lib/create-global-cost-settings-table";
import { listGlobalCostSettings } from "../lib/global-cost-settings-service";

async function main() {
  await createGlobalCostSettingsTable();
  const settings = await listGlobalCostSettings();
  console.log(
    JSON.stringify(
      {
        ok: true,
        count: settings.length,
        message:
          "global_cost_settings table created and route global columns removed",
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
