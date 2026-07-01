import type { Prisma } from "@prisma/client";

export type CrateChangeAction =
  | "inbound_crate_edit"
  | "crate_stock_manual_edit"
  | "sadao_stock_adjust"
  | "crate_return_arrived"
  | "crate_export"
  | "agent_create"
  | "agent_add_member"
  | "agent_remove_member"
  | "multi_origin_config";

export interface CrateChangeLogInput {
  action: CrateChangeAction;
  shipperId?: string | null;
  shipperName?: string | null;
  crateType?: string | null;
  beforeValue?: string | null;
  afterValue?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  summary: string;
}

export interface CrateAuditActor {
  id: string;
  name?: string | null;
  email?: string | null;
}

const CRATE_INBOUND_FIELDS = new Set(["桶型 Crate Type", "桶数 Crates"]);

export const CRATE_AUDIT_ACTION_LABELS: Record<CrateChangeAction, string> = {
  inbound_crate_edit: "改进货桶型/数量",
  crate_stock_manual_edit: "桶库存直接编辑",
  sadao_stock_adjust: "SADAO库存调整",
  crate_return_arrived: "空桶回收到达",
  crate_export: "空桶归还",
  agent_create: "新建代理",
  agent_add_member: "代理归入成员",
  agent_remove_member: "代理移出成员",
  multi_origin_config: "多产地配置",
};

export function crateAuditActorName(actor: CrateAuditActor): string {
  return actor.name?.trim() || actor.email?.trim() || "—";
}

export function crateAuditActionLabel(action: string): string {
  return (
    CRATE_AUDIT_ACTION_LABELS[action as CrateChangeAction] ?? action
  );
}

export function crateAuditDeepLink(
  action: CrateChangeAction,
  metadata: Record<string, unknown>
): string | undefined {
  switch (action) {
    case "inbound_crate_edit": {
      const sessionNo =
        typeof metadata.sessionNo === "string" ? metadata.sessionNo : "";
      return sessionNo
        ? `/inbound?sessionNo=${encodeURIComponent(sessionNo)}`
        : "/inbound";
    }
    case "crate_stock_manual_edit":
    case "agent_create":
    case "agent_add_member":
    case "agent_remove_member":
    case "multi_origin_config":
      return "/crate/customer-stock";
    case "sadao_stock_adjust":
      return "/crate/stock";
    case "crate_return_arrived":
      return "/crate/import";
    case "crate_export": {
      const exportNo =
        typeof metadata.exportNo === "string" ? metadata.exportNo : "";
      return exportNo
        ? `/crate/export?exportNo=${encodeURIComponent(exportNo)}`
        : "/crate/export";
    }
    default:
      return undefined;
  }
}

export function buildCrateFeedChanges(log: {
  action: string;
  crateType: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  summary: string;
}): Array<{ field: string; from: string; to: string }> {
  const field = log.crateType
    ? `${crateAuditActionLabel(log.action)} · ${log.crateType}`
    : crateAuditActionLabel(log.action);

  if (log.beforeValue != null || log.afterValue != null) {
    return [
      {
        field,
        from: log.beforeValue ?? "—",
        to: log.afterValue ?? "—",
      },
    ];
  }

  return [
    {
      field,
      from: "—",
      to: log.summary || "—",
    },
  ];
}

export function buildInboundCrateEditAuditLogs(input: {
  shipperId: string;
  shipperName: string;
  sessionNo: string | null;
  sessionId: string;
  changeLogs: Array<{
    field: string;
    fromValue: string;
    toValue: string;
  }>;
}): CrateChangeLogInput[] {
  const crateChanges = input.changeLogs.filter((log) =>
    CRATE_INBOUND_FIELDS.has(log.field)
  );
  if (crateChanges.length === 0) return [];

  return crateChanges.map((log) => {
    const isType = log.field.includes("桶型");
    const metadata = {
      sessionId: input.sessionId,
      sessionNo: input.sessionNo,
      field: log.field,
    };
    const summary = [
      input.sessionNo ?? input.sessionId,
      input.shipperName,
      isType ? `桶型 ${log.fromValue} → ${log.toValue}` : `数量 ${log.fromValue} → ${log.toValue}`,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      action: "inbound_crate_edit" as const,
      shipperId: input.shipperId,
      shipperName: input.shipperName,
      crateType: isType ? log.toValue.split(" ")[0] : null,
      beforeValue: log.fromValue,
      afterValue: log.toValue,
      metadata,
      summary,
    };
  });
}

export async function appendCrateChangeLogs(
  tx: Prisma.TransactionClient,
  input: {
    actor: CrateAuditActor;
    logs: CrateChangeLogInput[];
  }
) {
  if (input.logs.length === 0) return;

  const changedByName = crateAuditActorName(input.actor);
  await tx.crateChangeLog.createMany({
    data: input.logs.map((log) => ({
      action: log.action,
      shipperId: log.shipperId ?? null,
      shipperName: log.shipperName ?? null,
      crateType: log.crateType ?? null,
      beforeValue: log.beforeValue ?? null,
      afterValue: log.afterValue ?? null,
      metadata: log.metadata ?? undefined,
      summary: log.summary,
      changedById: input.actor.id,
      changedByName,
    })),
  });
}

export interface CrateReturnArrivedLine {
  crateTypeCode: string;
  quantity: number;
}

export function buildCrateReturnArrivedAuditLog(input: {
  truckPlate: string;
  marketCode: string;
  dateStr: string;
  lines: CrateReturnArrivedLine[];
}): CrateChangeLogInput | null {
  if (input.lines.length === 0) return null;

  const qtySummary = input.lines
    .map((line) => `${line.crateTypeCode}×${line.quantity}`)
    .join(", ");
  const metadata: Prisma.InputJsonValue = {
    truckPlate: input.truckPlate,
    marketCode: input.marketCode,
    date: input.dateStr,
    lines: input.lines.map((line) => ({
      crateTypeCode: line.crateTypeCode,
      quantity: line.quantity,
    })),
  };

  return {
    action: "crate_return_arrived",
    beforeValue: "在途 on_the_way",
    afterValue: "到达 arrived",
    metadata,
    summary: `${input.truckPlate} · ${input.marketCode} · ${qtySummary}`,
  };
}
