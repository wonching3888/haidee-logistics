import type { CrateStockAgentMemberRow } from "@/app/actions/customer-crate-stock-agent";
import type { CrateTypeColumn } from "@/app/actions/customerCrateStock";

export interface SubCustomerChannelAffiliateSource {
  channelKey: string;
  label: string;
  ownerShipperId: string;
  parentShipper: { id: string; code: string; name: string };
}

function emptyQuantities(crateTypes: CrateTypeColumn[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const crateType of crateTypes) {
    quantities[crateType.id] = 0;
  }
  return quantities;
}

export function formatSubChannelAffiliateDisplayName(
  parentName: string,
  channelLabel: string
): string {
  return `${parentName}（经 ${channelLabel}）`;
}

export function buildSubChannelAffiliateMemberRow(
  crateTypes: CrateTypeColumn[],
  source: SubCustomerChannelAffiliateSource
): CrateStockAgentMemberRow {
  return {
    memberShipperId: source.parentShipper.id,
    memberShipperCode: source.parentShipper.code,
    memberShipperName: formatSubChannelAffiliateDisplayName(
      source.parentShipper.name,
      source.label
    ),
    quantities: emptyQuantities(crateTypes),
    locations: [],
    isSubChannelAffiliate: true,
    subChannelKey: source.channelKey,
    subChannelLabel: source.label,
  };
}

export function groupSubCustomerChannelAffiliatesByOwner(
  channels: SubCustomerChannelAffiliateSource[]
): Map<string, SubCustomerChannelAffiliateSource[]> {
  const byOwner = new Map<string, SubCustomerChannelAffiliateSource[]>();
  for (const channel of channels) {
    const list = byOwner.get(channel.ownerShipperId) ?? [];
    list.push(channel);
    byOwner.set(channel.ownerShipperId, list);
  }
  return byOwner;
}

export function mergeAgentMemberRowsWithSubChannelAffiliates(
  formalMembers: CrateStockAgentMemberRow[],
  crateTypes: CrateTypeColumn[],
  affiliates: SubCustomerChannelAffiliateSource[]
): CrateStockAgentMemberRow[] {
  const affiliateRows = affiliates.map((source) =>
    buildSubChannelAffiliateMemberRow(crateTypes, source)
  );
  return [...formalMembers, ...affiliateRows];
}

export function agentMemberRowKey(member: CrateStockAgentMemberRow): string {
  if (member.isSubChannelAffiliate && member.subChannelKey) {
    return `sub:${member.memberShipperId}:${member.subChannelKey}`;
  }
  return member.memberShipperId;
}
