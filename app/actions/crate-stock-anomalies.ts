"use server";

import { getCurrentUser } from "@/lib/auth";
import { toDateInputValue } from "@/lib/inbound-utils";
import {
  buildAgentBusinessLocationsByAgentId,
  buildAgentBusinessLocationsByShipperId,
  detectDuplicateImportAdjustment,
  detectNonStandardLocationsFromRows,
  detectReturnLocationMismatch,
  detectSadaoDailySpikes,
  mergeCrateStockAnomalies,
  NON_STANDARD_LEDGER_CHANGE_TYPES,
  NON_STANDARD_LEDGER_LOOKBACK_DAYS,
  RETURN_REVERSAL_LEDGER_TYPES,
  type CrateStockAnomaly,
  type CustomerLedgerRowWithShipper,
  type CustomerStockRow,
  type ImportArrivalRow,
  type SadaoDailyMovementRow,
  type StockAdjustmentRow,
} from "@/lib/crate-stock-anomalies";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

const IMPORT_SCAN_DAYS = 120;
const SADAO_SCAN_DAYS = 90;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface CrateStockAnomaliesResult {
  scannedAt: string;
  anomalies: CrateStockAnomaly[];
  countsByRule: Record<string, number>;
}

export async function getCrateStockAnomalies(): Promise<CrateStockAnomaliesResult> {
  await requireAdmin();

  const importSince = daysAgo(IMPORT_SCAN_DAYS);
  const sadaoSince = daysAgo(SADAO_SCAN_DAYS);
  const ledgerSince = daysAgo(NON_STANDARD_LEDGER_LOOKBACK_DAYS);

  const [
    importsRaw,
    adjustmentsRaw,
    ledgerRaw,
    stockRaw,
    originsRaw,
    sadaoImports,
    sadaoExports,
    sadaoAdjustments,
    activeAgentsRaw,
    agentMembersRaw,
    agentLedgerRaw,
  ] = await Promise.all([
    prisma.tongImport.findMany({
      where: {
        status: "arrived",
        OR: [
          { arrivedAt: { gte: importSince } },
          { createdAt: { gte: importSince } },
        ],
      },
      include: {
        truck: { select: { plate: true } },
        tongType: { select: { id: true, code: true } },
      },
    }),
    prisma.tongStockAdjustment.findMany({
      where: { createdAt: { gte: importSince } },
      include: { tongType: { select: { id: true, code: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customerCrateLedger.findMany({
      where: {
        changeType: { in: Array.from(RETURN_REVERSAL_LEDGER_TYPES) },
      },
      include: {
        shipper: {
          select: {
            id: true,
            code: true,
            name: true,
            isMultiOriginCustomer: true,
          },
        },
        crateType: { select: { code: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customerCrateStock.findMany({
      include: {
        shipper: {
          select: {
            id: true,
            code: true,
            name: true,
            isMultiOriginCustomer: true,
          },
        },
        crateType: { select: { code: true } },
      },
    }),
    prisma.customerOriginLocation.findMany({
      select: { shipperId: true, locationName: true },
    }),
    prisma.tongImport.findMany({
      where: {
        status: "arrived",
        date: { gte: sadaoSince },
      },
      select: { date: true, quantity: true, tongType: { select: { code: true } } },
    }),
    prisma.tongExport.findMany({
      where: { date: { gte: sadaoSince } },
      select: {
        date: true,
        quantityActual: true,
        tongType: { select: { code: true } },
      },
    }),
    prisma.tongStockAdjustment.findMany({
      where: { date: { gte: sadaoSince } },
      select: { date: true, quantity: true, tongType: { select: { code: true } } },
    }),
    prisma.shipper.findMany({
      where: { shipperKind: "crate_stock_agent", active: true },
      select: { id: true },
    }),
    prisma.crateStockAgentMember.findMany({
      select: { agentShipperId: true, memberShipperId: true },
    }),
    prisma.customerCrateLedger.findMany({
      where: {
        shipper: { shipperKind: "crate_stock_agent", active: true },
      },
      select: { shipperId: true, location: true },
    }),
  ]);

  const originsByShipper = new Map<string, string[]>();
  for (const o of originsRaw) {
    const list = originsByShipper.get(o.shipperId) ?? [];
    list.push(o.locationName.trim());
    originsByShipper.set(o.shipperId, list);
  }

  const imports: ImportArrivalRow[] = importsRaw.map((r) => ({
    id: r.id,
    plate: r.truck.plate,
    tripDate: r.date,
    tongTypeId: r.tongTypeId,
    tongCode: r.tongType.code,
    quantity: r.quantity,
    arrivedAt: r.arrivedAt,
    createdAt: r.createdAt,
  }));

  const adjustments: StockAdjustmentRow[] = adjustmentsRaw.map((r) => ({
    id: r.id,
    tongTypeId: r.tongTypeId,
    tongCode: r.tongType.code,
    quantity: r.quantity,
    date: r.date,
    createdAt: r.createdAt,
    notes: r.notes,
  }));

  const stockRows: CustomerStockRow[] = stockRaw.map((r) => ({
    shipperId: r.shipperId,
    shipperCode: r.shipper.code,
    shipperName: r.shipper.name,
    isMultiOriginCustomer: r.shipper.isMultiOriginCustomer,
    originLocationNames: originsByShipper.get(r.shipperId) ?? [],
    crateCode: r.crateType.code,
    location: r.location,
    quantity: r.quantity,
  }));

  const ledgerRows: CustomerLedgerRowWithShipper[] = ledgerRaw.map((r) => ({
    id: r.id,
    shipperId: r.shipperId,
    shipperCode: r.shipper.code,
    shipperName: r.shipper.name,
    isMultiOriginCustomer: r.shipper.isMultiOriginCustomer,
    originLocationNames: originsByShipper.get(r.shipperId) ?? [],
    crateCode: r.crateType.code,
    location: r.location,
    changeType: r.changeType,
    quantity: r.quantity,
    notes: r.notes,
    createdAt: r.createdAt,
  }));

  const recentLedgerForNonStd = await prisma.customerCrateLedger.findMany({
    where: {
      createdAt: { gte: ledgerSince },
      changeType: { in: Array.from(NON_STANDARD_LEDGER_CHANGE_TYPES) },
    },
    include: {
      shipper: {
        select: {
          id: true,
          code: true,
          name: true,
          isMultiOriginCustomer: true,
        },
      },
      crateType: { select: { code: true } },
    },
  });

  const recentLedgerRows: CustomerLedgerRowWithShipper[] =
    recentLedgerForNonStd.map((r) => ({
      id: r.id,
      shipperId: r.shipperId,
      shipperCode: r.shipper.code,
      shipperName: r.shipper.name,
      isMultiOriginCustomer: r.shipper.isMultiOriginCustomer,
      originLocationNames: originsByShipper.get(r.shipperId) ?? [],
      crateCode: r.crateType.code,
      location: r.location,
      changeType: r.changeType,
      quantity: r.quantity,
      notes: r.notes,
      createdAt: r.createdAt,
    }));

  const dailyMap = new Map<string, number>();
  function addDaily(date: Date, tongCode: string, delta: number) {
    const key = `${toDateInputValue(date)}|${tongCode}`;
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + delta);
  }
  for (const r of sadaoImports) {
    addDaily(r.date, r.tongType.code, r.quantity);
  }
  for (const r of sadaoExports) {
    addDaily(r.date, r.tongType.code, -r.quantityActual);
  }
  for (const r of sadaoAdjustments) {
    addDaily(r.date, r.tongType.code, r.quantity);
  }
  const sadaoDaily: SadaoDailyMovementRow[] = Array.from(dailyMap.entries()).map(
    ([key, netChange]) => {
      const [date, tongCode] = key.split("|");
      return { date, tongCode, netChange };
    }
  );

  const activeAgentIds = activeAgentsRaw.map((a) => a.id);
  const memberToAgentId = new Map<string, string>();
  for (const m of agentMembersRaw) {
    memberToAgentId.set(m.memberShipperId, m.agentShipperId);
  }

  const agentBusinessLocationsByAgentId = buildAgentBusinessLocationsByAgentId({
    agentShipperIds: activeAgentIds,
    stockRows: stockRaw.map((r) => ({
      shipperId: r.shipperId,
      location: r.location,
      quantity: r.quantity,
    })),
    agentLedgerRows: agentLedgerRaw,
  });
  const agentBusinessLocationsByShipperId =
    buildAgentBusinessLocationsByShipperId({
      agentBusinessLocationsByAgentId,
      memberToAgentId,
    });

  const anomalies = mergeCrateStockAnomalies([
    detectDuplicateImportAdjustment(imports, adjustments),
    detectReturnLocationMismatch(ledgerRows),
    detectNonStandardLocationsFromRows({
      stockRows,
      ledgerRows: recentLedgerRows,
      ledgerSince,
      agentBusinessLocationsByShipperId,
    }),
    detectSadaoDailySpikes(sadaoDaily),
  ]);

  const countsByRule: Record<string, number> = {};
  for (const a of anomalies) {
    countsByRule[a.rule] = (countsByRule[a.rule] ?? 0) + 1;
  }

  return {
    scannedAt: new Date().toISOString(),
    anomalies,
    countsByRule,
  };
}
