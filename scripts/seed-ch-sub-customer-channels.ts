/**
 * Seed CH FISHERY sub-customer channels (self / RANONG / Songkhla pool).
 * Usage: npx tsx scripts/seed-ch-sub-customer-channels.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const PARENT_CODE = process.env.SUB_CHANNEL_PARENT_CODE ?? "3001-C003";
const RANONG_AGENT_CODE =
  process.env.SUB_CHANNEL_RANONG_AGENT ?? "AGENT-RANONG_THONG-2";
const SONGKHLA_POOL_CODE = "LOC-SONGKHLA";

async function main() {
  const { prisma } = await import("@/lib/prisma");

  const parent = await prisma.shipper.findFirst({
    where: { code: PARENT_CODE, active: true },
    select: { id: true, code: true, name: true, isMultiOriginCustomer: true },
  });
  if (!parent) {
    throw new Error(`Parent shipper not found: ${PARENT_CODE}`);
  }

  const ranongAgent = await prisma.shipper.findFirst({
    where: { code: RANONG_AGENT_CODE, active: true },
    select: { id: true, code: true, name: true },
  });
  if (!ranongAgent) {
    throw new Error(`Ranong agent not found: ${RANONG_AGENT_CODE}`);
  }

  const songkhlaPool = await prisma.shipper.findFirst({
    where: { code: SONGKHLA_POOL_CODE, active: true },
    select: { id: true, code: true, name: true },
  });
  if (!songkhlaPool) {
    throw new Error(`Songkhla pool not found: ${SONGKHLA_POOL_CODE}`);
  }

  const channels = [
    {
      channelKey: "self",
      label: "CH 自己",
      ownerType: "self",
      ownerShipperId: parent.id,
      allowMultiOrigin: parent.isMultiOriginCustomer,
      sortOrder: 0,
    },
    {
      channelKey: "ranong",
      label: "CH RANONG",
      ownerType: "agent",
      ownerShipperId: ranongAgent.id,
      allowMultiOrigin: false,
      sortOrder: 1,
    },
    {
      channelKey: "songkhla",
      label: "CH SONGKHLA",
      ownerType: "pool",
      ownerShipperId: songkhlaPool.id,
      allowMultiOrigin: false,
      sortOrder: 2,
    },
  ] as const;

  for (const channel of channels) {
    await prisma.subCustomerChannel.upsert({
      where: {
        parentShipperId_channelKey: {
          parentShipperId: parent.id,
          channelKey: channel.channelKey,
        },
      },
      create: {
        parentShipperId: parent.id,
        ...channel,
      },
      update: {
        label: channel.label,
        ownerType: channel.ownerType,
        ownerShipperId: channel.ownerShipperId,
        allowMultiOrigin: channel.allowMultiOrigin,
        sortOrder: channel.sortOrder,
        active: true,
      },
    });
    console.log(
      `✓ ${parent.code} / ${channel.channelKey} → ${channel.ownerType}`
    );
  }

  console.log(`Done. Parent: ${parent.name} (${parent.code})`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
