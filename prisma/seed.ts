import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
  { code: "ABB", name: "ABIBA", trackInventory: true, isBox: false, displayOrder: 1 },
  { code: "WTL", name: "WTL", trackInventory: true, isBox: false, displayOrder: 2 },
  { code: "VIO", name: "VIOLET", trackInventory: true, isBox: false, displayOrder: 3 },
  { code: "MAR", name: "MAROON", trackInventory: true, isBox: false, displayOrder: 4 },
  { code: "SHK", name: "SHK", trackInventory: true, isBox: false, displayOrder: 5 },
  { code: "GKS", name: "GKS", trackInventory: true, isBox: false, displayOrder: 6 },
  { code: "BRO", name: "BRO", trackInventory: true, isBox: false, displayOrder: 7 },
  { code: "GLY", name: "GLORY", trackInventory: true, isBox: false, displayOrder: 8 },
  { code: "BS", name: "BS", trackInventory: true, isBox: false, displayOrder: 9 },
  { code: "BHR", name: "BHR", trackInventory: true, isBox: false, displayOrder: 10 },
  { code: "LL_BHR", name: "LL(BHR)", trackInventory: false, isBox: false, displayOrder: 11 },
  { code: "BH", name: "BH", trackInventory: true, isBox: false, displayOrder: 14 },
  { code: "SHS", name: "SHS", trackInventory: true, isBox: false, displayOrder: 15 },
  { code: "OTHER", name: "Other", trackInventory: false, isBox: false, displayOrder: 16 },
  { code: "BOX", name: "盒装BOX", trackInventory: false, isBox: true, displayOrder: 17 },
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
