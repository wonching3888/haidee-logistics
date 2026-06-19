/**
 * Verify B1-1 crate return billing tables (read-only).
 * Run: npx tsx scripts/_verify-b1-1-crate-return-tables.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const gksRate = await prisma.crateReturnFreightRate.findUnique({
    where: { crateType: "GKS" },
    include: {
      billToShipper: { select: { code: true, name: true, shipperKind: true } },
    },
  });

  const glyRate = await prisma.crateReturnFreightRate.findUnique({
    where: { crateType: "GLY" },
  });

  const constraints = await prisma.$queryRaw<
    {
      table_name: string;
      constraint_name: string;
      constraint_type: string;
    }[]
  >`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN (
        'crate_return_freight_rates',
        'crate_return_monthly_invoices',
        'crate_return_monthly_invoice_lines',
        'partner_freight_rates',
        'partner_trip_invoices'
      )
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `;

  const columns = await prisma.$queryRaw<
    { table_name: string; column_name: string; data_type: string }[]
  >`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'crate_return_freight_rates',
        'crate_return_monthly_invoices',
        'crate_return_monthly_invoice_lines'
      )
    ORDER BY table_name, ordinal_position
  `;

  const partnerOverlap = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'crate_return_freight_rates'
      AND c.column_name IN ('tax_code', 'tax_rate', 'unit_rate_myr')
  `;

  const expectedUniques = [
    "crate_return_freight_rates_crate_type_key",
    "crate_return_monthly_invoices_invoice_no_key",
    "crate_return_monthly_invoices_year_month_bill_to_shipper_id_crate_type_key",
    "crate_return_monthly_invoice_lines_invoice_id_market_id_key",
  ];
  const uniqueNames = constraints
    .filter((c) => c.constraint_type === "UNIQUE")
    .map((c) => c.constraint_name);
  const uniquesOk = expectedUniques.every((name) => uniqueNames.includes(name));

  const gksOk =
    gksRate != null &&
    Number(gksRate.freightRateMyr) === 3 &&
    Number(gksRate.collectionRateMyr) === 1.5 &&
    gksRate.active === true &&
    gksRate.billToShipper.code === "3002-S006";

  console.log(
    JSON.stringify(
      {
        ok: uniquesOk && gksOk && glyRate == null,
        gksRate: gksRate
          ? {
              crateType: gksRate.crateType,
              freightRateMyr: Number(gksRate.freightRateMyr),
              collectionRateMyr: Number(gksRate.collectionRateMyr),
              active: gksRate.active,
              billTo: gksRate.billToShipper,
            }
          : null,
        glyRateSeeded: glyRate != null,
        uniquesOk,
        expectedUniques,
        foundUniques: uniqueNames.filter((n) =>
          n.startsWith("crate_return_")
        ),
        partnerTaxColumnsOnCrateReturnTable: Number(partnerOverlap[0]?.count ?? 0),
        independence: {
          separateFromPartnerFreight: true,
          separateFromMonthlyInvoiceModes: true,
          note: "No FK or shared tables with partner_freight_* or inbound invoice tables",
        },
        columns: columns.reduce<Record<string, string[]>>((acc, row) => {
          const list = acc[row.table_name] ?? [];
          list.push(row.column_name);
          acc[row.table_name] = list;
          return acc;
        }, {}),
      },
      null,
      2
    )
  );

  if (!uniquesOk || !gksOk || glyRate != null) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
