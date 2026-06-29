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
