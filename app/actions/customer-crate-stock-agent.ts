"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCustomerCrateStockEdit } from "@/lib/customer-crate-stock-permissions";
import { requireWrite } from "@/lib/require-auth";
import {
  getCustomerCrateStock,
  type CrateTypeColumn,
  type CustomerCrateLocationStock,
  type CustomerCrateStockRow,
} from "@/app/actions/customerCrateStock";
import {
  assertOperationalMemberShipper,
  isLegacyPoolAgentCode,
  LEGACY_POOL_AGENT_JOIN_NOTES,
  slugifyAgentShipperCode,
} from "@/lib/crate-stock-agent-transfer";
import {
  transferMemberStockToAgentInTx,
  zeroMemberStockOnRemoveInTx,
} from "@/lib/crate-stock-agent-membership-write";
import { OPERATIONAL_SHIPPER_WHERE, SHIPPER_KIND } from "@/lib/constants/shipper-kind";
import {
  filterPickupSummariesDedupedByAgents,
  sortAgentsForCustomerStockList,
} from "@/lib/customer-crate-stock-list";

export interface CrateStockAgentMemberRow {
  memberShipperId: string;
  memberShipperCode: string;
  memberShipperName: string;
  quantities: Record<string, number>;
  locations: CustomerCrateLocationStock[];
}

export interface CrateStockAgentRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  isLegacyPool: boolean;
  quantities: Record<string, number>;
  locations: CustomerCrateLocationStock[];
  members: CrateStockAgentMemberRow[];
}

export interface EligibleAgentMemberOption {
  id: string;
  code: string;
  name: string;
}

export interface AssignedMemberSearchHint {
  shipperId: string;
  shipperName: string;
  agentName: string;
}

async function loadAssignedMemberSearchHints(
  search: string
): Promise<AssignedMemberSearchHint[]> {
  const term = search.trim();
  if (!term) return [];

  const members = await prisma.shipper.findMany({
    where: {
      active: true,
      shipperKind: SHIPPER_KIND.OPERATIONAL,
      crateStockAgentMembership: { isNot: null },
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      crateStockAgentMembership: {
        select: {
          agentShipper: { select: { name: true } },
        },
      },
    },
  });

  return members.map((member) => ({
    shipperId: member.id,
    shipperName: member.name,
    agentName: member.crateStockAgentMembership!.agentShipper.name,
  }));
}

async function requireCrateStockEditor() {
  return requireCustomerCrateStockEdit();
}

function initQuantities(crateTypes: CrateTypeColumn[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const crateType of crateTypes) {
    quantities[crateType.id] = 0;
  }
  return quantities;
}

function buildStockRowFromRecords(
  crateTypes: CrateTypeColumn[],
  stocks: { crateTypeId: string; location: string; quantity: number }[]
): Pick<CustomerCrateStockRow, "quantities" | "locations"> {
  const quantities = initQuantities(crateTypes);
  const locationMap = new Map<string, Record<string, number>>();

  for (const stock of stocks) {
    const loc = stock.location?.trim() ?? "";
    if (!locationMap.has(loc)) {
      locationMap.set(loc, initQuantities(crateTypes));
    }
    const locQty = locationMap.get(loc)!;
    locQty[stock.crateTypeId] = stock.quantity;
    quantities[stock.crateTypeId] =
      (quantities[stock.crateTypeId] ?? 0) + stock.quantity;
  }

  const locations = Array.from(locationMap.entries())
    .map(([location, locQuantities]) => ({
      location,
      quantities: locQuantities,
    }))
    .sort((a, b) => {
      if (a.location === "") return 1;
      if (b.location === "") return -1;
      return a.location.localeCompare(b.location);
    });

  return { quantities, locations };
}

async function loadCrateStockAgentRows(
  crateTypes: CrateTypeColumn[]
): Promise<CrateStockAgentRow[]> {
  const agents = await prisma.shipper.findMany({
    where: {
      active: true,
      shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
    },
    orderBy: { name: "asc" },
    include: {
      customerCrateStock: {
        select: { crateTypeId: true, location: true, quantity: true },
      },
      crateStockAgentMembers: {
        include: {
          memberShipper: {
            select: {
              id: true,
              code: true,
              name: true,
              customerCrateStock: {
                select: { crateTypeId: true, location: true, quantity: true },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  return agents.map((agent) => {
    const { quantities, locations } = buildStockRowFromRecords(
      crateTypes,
      agent.customerCrateStock
    );

    return {
      shipperId: agent.id,
      shipperCode: agent.code,
      shipperName: agent.name,
      isLegacyPool: isLegacyPoolAgentCode(agent.code),
      quantities,
      locations,
      members: agent.crateStockAgentMembers.map((membership) => {
        const memberStock = buildStockRowFromRecords(
          crateTypes,
          membership.memberShipper.customerCrateStock
        );
        return {
          memberShipperId: membership.memberShipper.id,
          memberShipperCode: membership.memberShipper.code,
          memberShipperName: membership.memberShipper.name,
          quantities: memberStock.quantities,
          locations: memberStock.locations,
        };
      }),
    };
  });
}

function eligibleMemberWhere(search?: string): Prisma.ShipperWhereInput {
  return {
    ...OPERATIONAL_SHIPPER_WHERE,
    crateStockAgentMembership: { is: null },
    ...(search?.trim()
      ? {
          OR: [
            { name: { contains: search.trim(), mode: "insensitive" as const } },
            { code: { contains: search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export async function getCustomerCrateStockPageData(search?: string) {
  await requireWrite();
  const base = await getCustomerCrateStock(search);
  const agents = sortAgentsForCustomerStockList(
    await loadCrateStockAgentRows(base.crateTypes)
  );
  const pickupLocationSummaries = filterPickupSummariesDedupedByAgents(
    base.pickupLocationSummaries,
    agents
  );
  const assignedMemberHints = await loadAssignedMemberSearchHints(search ?? "");
  return { ...base, agents, pickupLocationSummaries, assignedMemberHints };
}

export async function searchEligibleAgentMembers(
  query: string
): Promise<EligibleAgentMemberOption[]> {
  await requireCrateStockEditor();
  const shippers = await prisma.shipper.findMany({
    where: eligibleMemberWhere(query),
    orderBy: { name: "asc" },
    take: 30,
    select: { id: true, code: true, name: true },
  });
  return shippers;
}

async function uniqueAgentCode(baseCode: string): Promise<string> {
  const normalized = baseCode.startsWith("AGENT-")
    ? baseCode
    : `AGENT-${baseCode}`;
  let candidate = normalized;
  let suffix = 2;
  while (await prisma.shipper.findUnique({ where: { code: candidate } })) {
    candidate = `${normalized}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createCrateStockAgent(input: {
  name: string;
  code?: string;
  notes?: string;
}) {
  await requireCrateStockEditor();
  const name = input.name.trim();
  if (!name) {
    throw new Error("代理名称必填 Agent name is required");
  }

  const slug = input.code?.trim()
    ? slugifyAgentShipperCode(input.code)
    : slugifyAgentShipperCode(name);
  const code = await uniqueAgentCode(slug);

  const agent = await prisma.shipper.create({
    data: {
      code,
      name,
      shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
      active: true,
    },
    select: { id: true, code: true, name: true },
  });

  revalidatePath("/crate/customer-stock");
  return agent;
}

export async function addAgentMember(
  agentShipperId: string,
  memberShipperId: string
) {
  const user = await requireCrateStockEditor();

  await prisma.$transaction(async (tx) => {
    const [agent, member] = await Promise.all([
      tx.shipper.findUnique({
        where: { id: agentShipperId },
        select: { id: true, code: true, name: true, shipperKind: true, active: true },
      }),
      tx.shipper.findUnique({
        where: { id: memberShipperId },
        select: {
          id: true,
          code: true,
          name: true,
          shipperKind: true,
          active: true,
          crateStockAgentMembership: { select: { agentShipperId: true } },
        },
      }),
    ]);

    if (!agent?.active || agent.shipperKind !== SHIPPER_KIND.CRATE_STOCK_AGENT) {
      throw new Error("代理主体无效 Invalid crate stock agent");
    }
    if (!member) {
      throw new Error("寄货人不存在 Shipper not found");
    }
    if (member.id === agent.id) {
      throw new Error("代理不能归入自身 Agent cannot be its own member");
    }
    assertOperationalMemberShipper(member);

    const skipTransfer = isLegacyPoolAgentCode(agent.code);
    const stockSnapshot = await transferMemberStockToAgentInTx(tx, {
      agentShipperId: agent.id,
      agentShipperName: agent.name,
      memberShipperId: member.id,
      memberShipperName: member.name,
      skipTransfer,
    });

    await tx.crateStockAgentMember.create({
      data: {
        agentShipperId: agent.id,
        memberShipperId: member.id,
        joinedById: user.id,
      },
    });

    await tx.crateStockAgentMembershipLog.create({
      data: {
        action: "join",
        agentShipperId: agent.id,
        memberShipperId: member.id,
        userId: user.id,
        stockSnapshot: stockSnapshot as unknown as Prisma.InputJsonValue,
        notes: skipTransfer ? LEGACY_POOL_AGENT_JOIN_NOTES : null,
      },
    });
  });

  revalidatePath("/crate/customer-stock");
  return { ok: true as const };
}

export async function removeAgentMember(memberShipperId: string) {
  const user = await requireCrateStockEditor();

  await prisma.$transaction(async (tx) => {
    const membership = await tx.crateStockAgentMember.findUnique({
      where: { memberShipperId },
      include: {
        agentShipper: { select: { id: true, name: true, shipperKind: true } },
        memberShipper: { select: { id: true, name: true } },
      },
    });

    if (!membership) {
      throw new Error("该寄货人未归属代理 Member is not assigned to an agent");
    }
    if (membership.agentShipper.shipperKind !== SHIPPER_KIND.CRATE_STOCK_AGENT) {
      throw new Error("代理主体无效 Invalid crate stock agent");
    }

    const stockSnapshot = await zeroMemberStockOnRemoveInTx(tx, {
      memberShipperId: membership.memberShipperId,
      agentShipperName: membership.agentShipper.name,
    });

    await tx.crateStockAgentMember.delete({
      where: { memberShipperId },
    });

    await tx.crateStockAgentMembershipLog.create({
      data: {
        action: "remove",
        agentShipperId: membership.agentShipperId,
        memberShipperId: membership.memberShipperId,
        userId: user.id,
        stockSnapshot: stockSnapshot as unknown as Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath("/crate/customer-stock");
  return { ok: true as const };
}
