import { prisma } from "@/lib/prisma";

/** memberShipperId → agentShipperId (active memberships only). */
export async function loadCrateStockAgentMembershipByMemberId(): Promise<
  Map<string, string>
> {
  const rows = await prisma.crateStockAgentMember.findMany({
    select: { memberShipperId: true, agentShipperId: true },
  });

  return new Map(
    rows.map((row) => [row.memberShipperId, row.agentShipperId])
  );
}

/** agentShipperId → agent code (for location-pool stock routing). */
export async function loadCrateStockAgentCodeByShipperId(): Promise<
  Map<string, string>
> {
  const rows = await prisma.crateStockAgentMember.findMany({
    select: {
      agentShipperId: true,
      agentShipper: { select: { code: true } },
    },
  });

  const out = new Map<string, string>();
  for (const row of rows) {
    out.set(row.agentShipperId, row.agentShipper.code);
  }
  return out;
}
