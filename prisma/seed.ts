import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_ROUTE_MASTERS } from "../lib/constants/route-master-seed";
import { DEFAULT_CRATE_RENTAL_RATES } from "../lib/constants/crate-rental-rates";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const MARKETS = [
  { code: "KL", name: "SELAYANG", state: "Selangor" },
  { code: "BM", name: "Pasar Borong Bukit Mertajam", state: "Penang" },
  { code: "A", name: "Pasar Borong Ipoh", state: "Perak" },
  { code: "KD", name: "Pasar Borong Alor Setar", state: "Kedah" },
  { code: "P", name: "Pasar Borong Penang", state: "Penang" },
  { code: "MC", name: "Pasar Borong Melaka", state: "Melaka" },
  { code: "BP", name: "Pasar Borong Batu Pahat", state: "Johor" },
  { code: "MP", name: "Pasar Borong Muar", state: "Johor" },
  { code: "TP", name: "Pasar Borong Taiping", state: "Perak" },
  { code: "SL", name: "SEREMBAN", state: "Negeri Sembilan" },
  { code: "KT", name: "Tanjung Piandang", state: "Perak" },
  { code: "NT", name: "N'Tebal", state: "Penang" },
  { code: "SA", name: "Simpang Ampat", state: "Penang" },
  { code: "JB", name: "Johor Bahru", state: "Johor" },
  { code: "OTHER", name: "OTHER" },
  { code: "ABIBA", name: "ABIBA" },
  { code: "ALPS", name: "ALPS" },
  { code: "ECONSAVE", name: "ECONSAVE" },
  { code: "OTHERS", name: "OTHERS" },
];

const TONG_TYPES = [
  { code: "ABB", name: "ABIBA", trackInventory: true, isBox: false, displayOrder: 1, showInInbound: true },
  { code: "WTL", name: "WTL", trackInventory: true, isBox: false, displayOrder: 2, showInInbound: true },
  { code: "BHR", name: "BHR", trackInventory: true, isBox: false, displayOrder: 3, showInInbound: true },
  { code: "LL_BHR", name: "LL(BHR)", trackInventory: false, isBox: false, displayOrder: 4, showInInbound: true },
  { code: "VIO", name: "VIOLET", trackInventory: true, isBox: false, displayOrder: 5, showInInbound: true },
  { code: "MAR", name: "MAROON", trackInventory: true, isBox: false, displayOrder: 6, showInInbound: true },
  { code: "SHK", name: "SHK", trackInventory: true, isBox: false, displayOrder: 7, showInInbound: true },
  { code: "GKS", name: "GKS", trackInventory: true, isBox: false, displayOrder: 8, showInInbound: true },
  { code: "BRO", name: "BRO", trackInventory: true, isBox: false, displayOrder: 9, showInInbound: true },
  { code: "GLY", name: "GLORY", trackInventory: true, isBox: false, displayOrder: 10, showInInbound: true },
  { code: "SKTN", name: "TAWAKAR", trackInventory: true, isBox: false, displayOrder: 11, showInInbound: false },
  { code: "BS", name: "BS", trackInventory: true, isBox: false, displayOrder: 12, showInInbound: true },
  { code: "BH", name: "BH", trackInventory: true, isBox: false, displayOrder: 13, showInInbound: true },
  { code: "SHS", name: "SHS", trackInventory: true, isBox: false, displayOrder: 14, showInInbound: true },
  { code: "OTHER", name: "Other", trackInventory: false, isBox: false, displayOrder: 15, showInInbound: true },
  { code: "BOX", name: "盒装BOX", trackInventory: false, isBox: true, displayOrder: 16, showInInbound: true },
];

async function main() {
  const MARKET_ORDER_SEED = [
    "KL", "BP", "MP", "SL", "MC", "A", "BM", "P", "TP", "NT", "KT", "SA", "KD", "JB", "OTHER",
  ];

  console.log("Seeding markets...");
  for (const market of MARKETS) {
    const orderIdx = MARKET_ORDER_SEED.indexOf(market.code);
    await prisma.market.upsert({
      where: { code: market.code },
      update: {
        name: market.name,
        state: market.state,
        displayOrder: orderIdx >= 0 ? orderIdx + 1 : 99,
      },
      create: {
        ...market,
        displayOrder: orderIdx >= 0 ? orderIdx + 1 : 99,
      },
    });
  }
  console.log(`  ✓ ${MARKETS.length} markets`);

  console.log("Seeding tong types...");
  for (const tong of TONG_TYPES) {
    await prisma.tongType.upsert({
      where: { code: tong.code },
      update: {
        name: tong.name,
        trackInventory: tong.trackInventory,
        isBox: tong.isBox,
        displayOrder: tong.displayOrder,
        showInInbound: tong.showInInbound,
      },
      create: tong,
    });
  }
  console.log(`  ✓ ${TONG_TYPES.length} tong types`);

  const abb = await prisma.tongType.findUnique({ where: { code: "ABB" } });
  const wtl = await prisma.tongType.findUnique({ where: { code: "WTL" } });
  const vio = await prisma.tongType.findUnique({ where: { code: "VIO" } });
  const mar = await prisma.tongType.findUnique({ where: { code: "MAR" } });
  if (!abb || !wtl || !vio || !mar) throw new Error("Tong types not found");

  const marketMap = Object.fromEntries(
    (await prisma.market.findMany()).map((m) => [m.code, m.id])
  );

  async function upsertStall(code: string, marketCode: string, name?: string) {
    const marketId = marketMap[marketCode];
    const existing = await prisma.stall.findFirst({ where: { code, marketId } });
    if (existing) return existing;
    return prisma.stall.create({
      data: { code, name, marketId },
    });
  }

  const SHIPPERS = [
    {
      code: "S001",
      name: "THAI TONG",
      tongTypeId: abb.id,
      stalls: [
        { code: "H41", market: "KL" },
        { code: "F38", market: "KL" },
        { code: "K38", market: "KD" },
        { code: "TP4", market: "TP" },
      ],
    },
    {
      code: "S002",
      name: "HONG LEE",
      tongTypeId: wtl.id,
      stalls: [
        { code: "A15", market: "BP" },
        { code: "B20", market: "KL" },
        { code: "C10", market: "MC" },
        { code: "P12", market: "P" },
      ],
    },
    {
      code: "S003",
      name: "CP BROTHER",
      tongTypeId: abb.id,
      stalls: [
        { code: "BM10", market: "BM" },
        { code: "A22", market: "A", tongTypeId: mar.id },
        { code: "KD5", market: "KD" },
        { code: "KL88", market: "KL" },
      ],
    },
  ];

  console.log("Seeding shippers, stalls & defaults...");
  for (const s of SHIPPERS) {
    const shipper = await prisma.shipper.upsert({
      where: { code: s.code },
      update: { name: s.name, defaultTongTypeId: s.tongTypeId },
      create: {
        code: s.code,
        name: s.name,
        defaultTongTypeId: s.tongTypeId,
      },
    });

    for (const st of s.stalls) {
      const stall = await upsertStall(st.code, st.market);
      const tongTypeId =
        "tongTypeId" in st && st.tongTypeId ? st.tongTypeId : s.tongTypeId;
      await prisma.shipperStallDefault.upsert({
        where: {
          shipperId_stallId: { shipperId: shipper.id, stallId: stall.id },
        },
        update: { tongTypeId },
        create: { shipperId: shipper.id, stallId: stall.id, tongTypeId },
      });
    }

    await prisma.thVehicle.upsert({
      where: { plate: `70-${s.code.slice(-3)}` },
      update: { shipperId: shipper.id },
      create: { plate: `70-${s.code.slice(-3)}`, shipperId: shipper.id },
    });
  }
  console.log(`  ✓ ${SHIPPERS.length} shippers with stalls`);

  const TRUCKS = [
    { plate: "KFU 3888", type: "big", capacityTong: 344 },
    { plate: "VNN 3888", type: "big", capacityTong: 300 },
    { plate: "KGC 3888", type: "small", capacityTong: 150 },
    { plate: "PQK 6398", type: "big", capacityTong: 320 },
  ];

  console.log("Seeding trucks...");
  for (const t of TRUCKS) {
    await prisma.truck.upsert({
      where: { plate: t.plate },
      update: { type: t.type, capacityTong: t.capacityTong },
      create: t,
    });
  }
  console.log(`  ✓ ${TRUCKS.length} trucks`);

  console.log("Seeding route masters...");
  for (const route of DEFAULT_ROUTE_MASTERS) {
    await prisma.routeMaster.upsert({
      where: { code: route.code },
      update: {
        name: route.name,
        markets: [...route.markets],
        displayOrder: route.displayOrder,
      },
      create: {
        code: route.code,
        name: route.name,
        markets: [...route.markets],
        displayOrder: route.displayOrder,
      },
    });
  }
  console.log(`  ✓ ${DEFAULT_ROUTE_MASTERS.length} route masters`);

  console.log("Seeding crate rental rates...");
  for (const item of DEFAULT_CRATE_RENTAL_RATES) {
    await prisma.crateRentalRate.upsert({
      where: { crateType: item.crateType },
      create: {
        crateType: item.crateType,
        isRental: item.isRental,
        rate: item.rate,
        currency: item.currency,
        notes: item.notes,
      },
      update: {},
    });
  }
  console.log(`  ✓ ${DEFAULT_CRATE_RENTAL_RATES.length} crate rental rates`);

  console.log("Seeding TAWAKAR logistics partner...");
  const TAWAKAR_LOCATION =
    "NO 6839, JALAN PERMATANG PAUH,\n13400 BUTTERWORTH,\nPENANG.";
  const tawakar = await prisma.shipper.upsert({
    where: { code: "3000-T002" },
    update: {
      name: "TAWAKAR ENTERPRISE SDN BHD",
      company: "wtl",
      currency: "MYR",
      shipperKind: "logistics_partner",
      location: TAWAKAR_LOCATION,
      pickupLocation: "SADAO",
      paymentParty: "shipper",
      active: true,
    },
    create: {
      code: "3000-T002",
      name: "TAWAKAR ENTERPRISE SDN BHD",
      company: "wtl",
      currency: "MYR",
      shipperKind: "logistics_partner",
      location: TAWAKAR_LOCATION,
      pickupLocation: "SADAO",
      paymentParty: "shipper",
      active: true,
    },
  });
  await prisma.partnerFreightRate.upsert({
    where: { crateType: "SKTN" },
    update: {
      billToShipperId: tawakar.id,
      unitRateMyr: 1.5,
      taxCode: "ESV-6",
      taxRate: 0,
      active: true,
    },
    create: {
      crateType: "SKTN",
      billToShipperId: tawakar.id,
      unitRateMyr: 1.5,
      taxCode: "ESV-6",
      taxRate: 0,
      active: true,
    },
  });
  console.log("  ✓ TAWAKAR + SKTN partner freight rate");

  console.log("Seeding crate return freight rates (GKS + GLY)...");
  const sakda = await prisma.shipper.findUnique({
    where: { code: "3002-S006" },
    select: { id: true },
  });
  if (sakda) {
    await prisma.crateReturnFreightRate.upsert({
      where: { crateType: "GKS" },
      update: {
        billToShipperId: sakda.id,
        freightRateMyr: 3.0,
        collectionRateMyr: 1.5,
        active: true,
      },
      create: {
        crateType: "GKS",
        billToShipperId: sakda.id,
        freightRateMyr: 3.0,
        collectionRateMyr: 1.5,
        active: true,
      },
    });
    console.log("  ✓ GKS crate return freight rate → Sakda");
  } else {
    console.log("  ⚠ Sakda 3002-S006 not found — skip GKS crate return rate");
  }

  const EPIC_GLORY_LOCATION =
    "3A, 1ST FLOOR, JALAN TUANKU HAMINAH 1,\nTAMAN TUANKU HAMINAH,\n08000 SUNGAI PETANI, KEDAH.";
  const epicGlory = await prisma.shipper.upsert({
    where: { code: "3002-E001" },
    update: {
      name: "EPIC GLORY SDN BHD",
      company: "haidee",
      currency: "MYR",
      shipperKind: "operational",
      location: EPIC_GLORY_LOCATION,
      pickupLocation: "SADAO",
      paymentParty: "shipper",
      defaultTongTypeId: null,
      active: true,
    },
    create: {
      code: "3002-E001",
      name: "EPIC GLORY SDN BHD",
      company: "haidee",
      currency: "MYR",
      shipperKind: "operational",
      location: EPIC_GLORY_LOCATION,
      pickupLocation: "SADAO",
      paymentParty: "shipper",
      defaultTongTypeId: null,
      active: true,
    },
  });
  await prisma.crateReturnFreightRate.upsert({
    where: { crateType: "GLY" },
    update: {
      billToShipperId: epicGlory.id,
      freightRateMyr: 1.5,
      collectionRateMyr: 0,
      active: true,
    },
    create: {
      crateType: "GLY",
      billToShipperId: epicGlory.id,
      freightRateMyr: 1.5,
      collectionRateMyr: 0,
      active: true,
    },
  });
  console.log("  ✓ Epic Glory + GLY crate return freight rate");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
