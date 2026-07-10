import type { Prisma } from "@prisma/client";
import { toDateInputValue } from "@/lib/inbound-utils";
import { loadCrateExportDayInput } from "@/lib/crate-export-day-context";
import type { BuildCrateExportDueTodayInput } from "@/lib/crate-export-due-today";
import { loadCrateStockAgentMembershipByMemberId } from "@/lib/crate-stock-agent-membership-service";

export interface CrateExportSyncContext {
  dateInput: string;
  shipperId: string;
}

export function mergeCrateExportSyncContexts(
  contexts: CrateExportSyncContext[]
): CrateExportSyncContext[] {
  const byKey = new Map<string, CrateExportSyncContext>();
  for (const ctx of contexts) {
    const dateInput = ctx.dateInput.trim();
    const shipperId = ctx.shipperId.trim();
    if (!dateInput || !shipperId) continue;
    byKey.set(`${dateInput}|${shipperId}`, { dateInput, shipperId });
  }
  return Array.from(byKey.values());
}

/** Pure helper: member inbound context → agent (+ pool parent) sync targets. */
export function agentParentSyncContextsForMember(
  ctx: CrateExportSyncContext,
  membershipByMemberId: Map<string, string>,
  dayInput: BuildCrateExportDueTodayInput
): CrateExportSyncContext[] {
  const agentId = membershipByMemberId.get(ctx.shipperId);
  if (!agentId) return [];

  const extra: CrateExportSyncContext[] = [
    { dateInput: ctx.dateInput, shipperId: agentId },
  ];

  const agent = dayInput.agents.get(agentId);
  if (agent?.isPool && agent.pickup) {
    const poolShipperId = dayInput.poolIds[agent.pickup];
    if (poolShipperId) {
      extra.push({ dateInput: ctx.dateInput, shipperId: poolShipperId });
    }
  }

  return extra;
}

/**
 * When a member's inbound is confirmed, also include agent / pool-parent contexts.
 * Kept for callers/tests that expand membership → parent shipper ids.
 * Does not by itself mutate tong_exports (see syncCrateExportSuggestedForContexts).
 */
export async function expandCrateExportSyncContextsWithAgentParents(
  contexts: CrateExportSyncContext[]
): Promise<CrateExportSyncContext[]> {
  const merged = mergeCrateExportSyncContexts(contexts);
  if (merged.length === 0) return merged;

  const membershipByMemberId = await loadCrateStockAgentMembershipByMemberId();
  const dayInputCache = new Map<string, BuildCrateExportDueTodayInput>();
  const extra: CrateExportSyncContext[] = [];

  for (const ctx of merged) {
    let dayInput = dayInputCache.get(ctx.dateInput);
    if (!dayInput) {
      dayInput = await loadCrateExportDayInput(ctx.dateInput);
      dayInputCache.set(ctx.dateInput, dayInput);
    }
    extra.push(
      ...agentParentSyncContextsForMember(ctx, membershipByMemberId, dayInput)
    );
  }

  return mergeCrateExportSyncContexts([...merged, ...extra]);
}

/**
 * Inbound confirm/edit used to call this to rewrite `quantitySuggested` on every
 * same-day saved return for the shipper (and agent/pool parents) using *current*
 * remaining owed — including unrelated inbound edits (e.g. BEST BROTHER TE-002
 * wiped to 0 after a later PHUKET inbound edit).
 *
 * Display policy (current): list / edit / print always recompute suggested live
 * via `resolveDisplaySuggestedForExport` (Dispatch due − other returns, excluding
 * the document being viewed). DB `quantitySuggested` remains a create/edit
 * snapshot for audit only — not used for on-screen "系统建议".
 *
 * Therefore this sync write-back is intentionally a no-op. Call sites in
 * `inbound.ts` stay so we do not churn those paths; they no longer mutate exports.
 */
export async function syncCrateExportSuggestedForContexts(
  contexts: CrateExportSyncContext[],
  _tx?: Prisma.TransactionClient
): Promise<{ updatedExportNos: string[] }> {
  void contexts;
  void _tx;
  return { updatedExportNos: [] };
}

export function collectInboundSaveSyncContexts(input: {
  before?: { date: Date; shipperId: string } | null;
  after: { date: Date; shipperId: string };
}): CrateExportSyncContext[] {
  return mergeCrateExportSyncContexts([
    {
      dateInput: toDateInputValue(input.after.date),
      shipperId: input.after.shipperId,
    },
    ...(input.before
      ? [
          {
            dateInput: toDateInputValue(input.before.date),
            shipperId: input.before.shipperId,
          },
        ]
      : []),
  ]);
}
