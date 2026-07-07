/**
 * Crate stock anomaly detection (v1) — pure rules + scan helpers.
 */
import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { toDateInputValue } from "@/lib/inbound-utils";

export const GLOBAL_STANDARD_LOCATIONS = new Set(["", "SONGKHLA", "PATTANI"]);

export const DUPLICATE_IMPORT_ADJUSTMENT_WINDOW_DAYS = 7;
export const SADAO_SPIKE_LOOKBACK_DAYS = 30;
export const SADAO_SPIKE_MULTIPLIER = 3;
export const NON_STANDARD_LEDGER_LOOKBACK_DAYS = 7;

export const NON_STANDARD_LEDGER_CHANGE_TYPES = new Set([
  "manual",
  "export",
  "export_void",
  "charter",
  "charter-reverse",
  "inbound",
  "inbound-edit",
  "inbound-delete",
]);

export type CrateStockAnomalyRuleId =
  | "duplicate_import_adjustment"
  | "return_location_mismatch"
  | "non_standard_location"
  | "sadao_daily_spike";

export const CRATE_STOCK_ANOMALY_RULE_LABELS: Record<
  CrateStockAnomalyRuleId,
  string
> = {
  duplicate_import_adjustment: "同车重复嫌疑",
  return_location_mismatch: "归还/包车冲销位置异常",
  non_standard_location: "非标准 location",
  sadao_daily_spike: "SADAO 单日异常波动",
};

export interface CrateStockAnomaly {
  id: string;
  rule: CrateStockAnomalyRuleId;
  ruleLabel: string;
  severity: "warning" | "info";
  title: string;
  detail: string;
  metadata: Record<string, string | number | null>;
}

export interface StandardLocationContext {
  shipperId: string;
  shipperCode: string;
  isMultiOriginCustomer: boolean;
  originLocations: ReadonlySet<string>;
  /** Locations derived from an agent's own stock/ledger; inherited by members. */
  agentBusinessLocations?: ReadonlySet<string>;
}

export function buildStandardLocationContext(input: {
  shipperId: string;
  shipperCode: string;
  isMultiOriginCustomer: boolean;
  originLocationNames: readonly string[];
  agentBusinessLocations?: ReadonlySet<string>;
}): StandardLocationContext {
  return {
    shipperId: input.shipperId,
    shipperCode: input.shipperCode,
    isMultiOriginCustomer: input.isMultiOriginCustomer,
    originLocations: new Set(
      input.originLocationNames.map((n) => n.trim()).filter(Boolean)
    ),
    agentBusinessLocations: input.agentBusinessLocations,
  };
}

/** Whether a customer_crate_stock / ledger location is allowed for this shipper. */
export function isStandardCustomerStockLocation(
  location: string,
  ctx: StandardLocationContext
): boolean {
  const loc = location.trim();
  if (loc === "") return true;

  const poolLoc = stockLocationForPoolShipperCode(ctx.shipperCode);
  if (poolLoc && (loc === poolLoc || loc === "SONGKHLA" || loc === "PATTANI")) {
    return true;
  }

  if (GLOBAL_STANDARD_LOCATIONS.has(loc)) {
    return true;
  }

  if (ctx.originLocations.has(loc)) {
    return true;
  }

  if (ctx.agentBusinessLocations?.has(loc)) {
    return true;
  }

  if (!ctx.isMultiOriginCustomer) {
    return false;
  }

  return ctx.originLocations.has(loc);
}

/** Per-agent business locations from the agent's own stock (non-zero) and ledger activity. */
export function buildAgentBusinessLocationsByAgentId(input: {
  agentShipperIds: readonly string[];
  stockRows: readonly { shipperId: string; location: string; quantity: number }[];
  agentLedgerRows: readonly { shipperId: string; location: string }[];
}): Map<string, Set<string>> {
  const agentIdSet = new Set(input.agentShipperIds);
  const byAgent = new Map<string, Set<string>>();
  for (const id of input.agentShipperIds) {
    byAgent.set(id, new Set());
  }

  for (const row of input.stockRows) {
    if (!agentIdSet.has(row.shipperId) || row.quantity === 0) continue;
    byAgent.get(row.shipperId)!.add(row.location.trim());
  }

  for (const row of input.agentLedgerRows) {
    if (!agentIdSet.has(row.shipperId)) continue;
    byAgent.get(row.shipperId)!.add(row.location.trim());
  }

  return byAgent;
}

/** Agent inherits its own set; members inherit their agent's business locations. */
export function buildAgentBusinessLocationsByShipperId(input: {
  agentBusinessLocationsByAgentId: ReadonlyMap<string, ReadonlySet<string>>;
  memberToAgentId: ReadonlyMap<string, string>;
}): Map<string, ReadonlySet<string>> {
  const result = new Map<string, ReadonlySet<string>>();
  for (const [agentId, locs] of Array.from(
    input.agentBusinessLocationsByAgentId.entries()
  )) {
    result.set(agentId, locs);
  }
  for (const [memberId, agentId] of Array.from(
    input.memberToAgentId.entries()
  )) {
    const locs = input.agentBusinessLocationsByAgentId.get(agentId);
    if (locs) result.set(memberId, locs);
  }
  return result;
}

export interface ImportArrivalRow {
  id: string;
  plate: string;
  tripDate: Date;
  tongTypeId: string;
  tongCode: string;
  quantity: number;
  arrivedAt: Date | null;
  createdAt: Date;
}

export interface StockAdjustmentRow {
  id: string;
  tongTypeId: string;
  tongCode: string;
  quantity: number;
  date: Date;
  createdAt: Date;
  notes: string | null;
}

export function importEventTime(row: ImportArrivalRow): Date {
  return row.arrivedAt ?? row.createdAt;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

function quantitiesMatch(importQty: number, adjustmentQty: number): boolean {
  if (importQty === 0 || adjustmentQty === 0) return false;
  return importQty === adjustmentQty;
}

type DuplicateImportMatch = {
  groupKey: string;
  plate: string;
  tripDate: string;
  importRow: ImportArrivalRow;
  adj: StockAdjustmentRow;
};

/** Rule 1: arrived import vs manual adjustment with same-sign qty within window. */
export function detectDuplicateImportAdjustment(
  imports: readonly ImportArrivalRow[],
  adjustments: readonly StockAdjustmentRow[],
  windowDays = DUPLICATE_IMPORT_ADJUSTMENT_WINDOW_DAYS
): CrateStockAnomaly[] {
  const anomalies: CrateStockAnomaly[] = [];
  const seen = new Set<string>();

  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    { plate: string; tripDate: string; rows: ImportArrivalRow[] }
  >();

  for (const row of imports) {
    const tripDate = toDateInputValue(row.tripDate);
    const key = `${row.plate.trim().toUpperCase()}|${tripDate}`;
    const g = groups.get(key) ?? {
      plate: row.plate.trim(),
      tripDate,
      rows: [],
    };
    g.rows.push(row);
    groups.set(key, g);
  }

  const allMatches: DuplicateImportMatch[] = [];

  for (const group of Array.from(groups.values())) {
    const groupKey = `${group.plate.trim().toUpperCase()}|${group.tripDate}`;
    const groupTimes = group.rows.map(importEventTime);
    const groupAnchor = new Date(
      Math.max(...groupTimes.map((d) => d.getTime()))
    );

    for (const importRow of group.rows) {
      for (const adj of adjustments) {
        if (importRow.tongTypeId !== adj.tongTypeId) continue;
        if (!quantitiesMatch(importRow.quantity, adj.quantity)) continue;

        const importTime = importEventTime(importRow);
        const span = daysBetween(importTime, adj.createdAt);
        const spanFromAnchor = daysBetween(groupAnchor, adj.createdAt);
        if (span > windowDays && spanFromAnchor > windowDays) continue;

        const dedupeKey = `${group.plate}|${group.tripDate}|${importRow.tongCode}|${importRow.id}|${adj.id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        allMatches.push({
          groupKey,
          plate: group.plate,
          tripDate: group.tripDate,
          importRow,
          adj,
        });
      }
    }
  }

  const tripsByAdj = new Map<
    string,
    Map<string, { plate: string; tripDate: string }>
  >();
  for (const match of allMatches) {
    const tripMap =
      tripsByAdj.get(match.adj.id) ??
      new Map<string, { plate: string; tripDate: string }>();
    tripMap.set(match.groupKey, {
      plate: match.plate,
      tripDate: match.tripDate,
    });
    tripsByAdj.set(match.adj.id, tripMap);
  }

  const matchesByTrip = new Map<string, DuplicateImportMatch[]>();
  for (const match of allMatches) {
    const list = matchesByTrip.get(match.groupKey) ?? [];
    list.push(match);
    matchesByTrip.set(match.groupKey, list);
  }

  for (const tripMatches of Array.from(matchesByTrip.values())) {
    const { plate, tripDate } = tripMatches[0];

    const matchedTypes = new Map<
      string,
      { importRow: ImportArrivalRow; adj: StockAdjustmentRow }
    >();
    for (const match of tripMatches) {
      matchedTypes.set(match.importRow.tongCode, {
        importRow: match.importRow,
        adj: match.adj,
      });
    }

    const typeSummary = Array.from(matchedTypes.entries())
      .map(
        ([code, { importRow, adj }]) =>
          `${code}: import=${importRow.quantity} adj=${adj.quantity}`
      )
      .join(", ");

    const ambiguousParts: string[] = [];
    const seenAdjNotes = new Set<string>();
    let maxAmbiguousTripCount = 0;
    const ambiguousCodes: string[] = [];
    const definiteCodes: string[] = [];

    for (const [code, { adj }] of Array.from(matchedTypes.entries())) {
      const tripCount = tripsByAdj.get(adj.id)?.size ?? 0;
      if (tripCount <= 1) {
        definiteCodes.push(code);
        continue;
      }
      ambiguousCodes.push(code);
      if (seenAdjNotes.has(adj.id)) continue;
      seenAdjNotes.add(adj.id);
      maxAmbiguousTripCount = Math.max(maxAmbiguousTripCount, tripCount);
      const candidates = Array.from(tripsByAdj.get(adj.id)!.values())
        .map((t) => `${t.plate} · ${t.tripDate}`)
        .join("; ");
      ambiguousParts.push(
        `此调整记录 (${adj.tongCode} ${adj.quantity >= 0 ? "+" : ""}${adj.quantity}) 同时匹配到 ${tripCount} 趟车，可能只有其中一趟是真正对应的，需人工确认。候选: ${candidates}`
      );
    }
    const hasAmbiguous = ambiguousParts.length > 0;
    const severity =
      definiteCodes.length > 0 ? "warning" : ("info" as const);

    let detail = `到达进货与人工调整在 ${windowDays} 天内同号桶型数量吻合: ${typeSummary}`;
    if (hasAmbiguous) {
      detail += `。${ambiguousParts.join("；")}`;
    }
    if (definiteCodes.length > 0 && ambiguousCodes.length > 0) {
      const ambLegSummary = ambiguousCodes
        .map((code) => {
          const adj = matchedTypes.get(code)!.adj;
          const tripCount = tripsByAdj.get(adj.id)?.size ?? 0;
          return `${code}匹配到${tripCount}趟车需人工确认`;
        })
        .join("，");
      detail += `。${definiteCodes.join("/")}为唯一确凿匹配，${ambLegSummary}`;
    }

    const first = matchedTypes.values().next().value!;
    anomalies.push({
      id: `dup|${plate}|${tripDate}|${first.importRow.id}|${first.adj.id}`,
      rule: "duplicate_import_adjustment",
      ruleLabel: CRATE_STOCK_ANOMALY_RULE_LABELS.duplicate_import_adjustment,
      severity,
      title: `${plate} · trip ${tripDate}`,
      detail,
      metadata: {
        plate,
        tripDate,
        matchedTypeCount: matchedTypes.size,
        importId: first.importRow.id,
        adjustmentId: first.adj.id,
        ambiguousMatch: hasAmbiguous ? 1 : 0,
        definiteTypeCount: definiteCodes.length,
        ambiguousTypeCount: ambiguousCodes.length,
        ...(hasAmbiguous
          ? { ambiguousTripCount: maxAmbiguousTripCount }
          : {}),
      },
    });
  }

  return anomalies.sort((a, b) => a.title.localeCompare(b.title));
}

export const RETURN_REVERSAL_LEDGER_TYPES = new Set([
  "export",
  "export_void",
  "charter",
  "charter-reverse",
]);

export function extractExportNo(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/TE-\d{8}-\d{3}/);
  return m?.[0] ?? null;
}

export function extractCharterNo(
  notes: string | null | undefined
): string | null {
  if (!notes) return null;
  const m = notes.match(/CH-\d{8}-\d{3}/);
  return m?.[0] ?? null;
}

export interface CustomerLedgerRow {
  id: string;
  shipperCode: string;
  shipperName: string;
  crateCode: string;
  location: string;
  changeType: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
}

/** Rule 2: same exportNo/charterNo with inconsistent locations on return/reversal ledgers. */
export function detectReturnLocationMismatch(
  rows: readonly CustomerLedgerRow[]
): CrateStockAnomaly[] {
  const byDoc = new Map<
    string,
    { kind: "export" | "charter"; no: string; rows: CustomerLedgerRow[] }
  >();

  for (const row of rows) {
    if (!RETURN_REVERSAL_LEDGER_TYPES.has(row.changeType)) continue;
    const exportNo = extractExportNo(row.notes);
    const charterNo = extractCharterNo(row.notes);
    const no = exportNo ?? charterNo;
    if (!no) continue;
    const kind = exportNo ? "export" : "charter";
    const key = `${kind}|${no}`;
    const bucket = byDoc.get(key) ?? { kind, no, rows: [] };
    bucket.rows.push(row);
    byDoc.set(key, bucket);
  }

  const anomalies: CrateStockAnomaly[] = [];

  for (const bucket of Array.from(byDoc.values())) {
    if (bucket.rows.length < 2) continue;
    const locations = Array.from(
      new Set(bucket.rows.map((r) => (r.location ?? "").trim()))
    );
    if (locations.length <= 1) continue;

    const locSummary = locations.map((l) => JSON.stringify(l)).join(" vs ");
    anomalies.push({
      id: `locmismatch|${bucket.kind}|${bucket.no}`,
      rule: "return_location_mismatch",
      ruleLabel: CRATE_STOCK_ANOMALY_RULE_LABELS.return_location_mismatch,
      severity: "warning",
      title: `${bucket.no} · ${locations.length} 个 location`,
      detail: `归还/冲销分录 location 不一致: ${locSummary} (${bucket.rows.length} 条)`,
      metadata: {
        documentNo: bucket.no,
        documentKind: bucket.kind,
        locationCount: locations.length,
        locations: locations.join("|"),
        ledgerRowCount: bucket.rows.length,
      },
    });
  }

  return anomalies.sort((a, b) => a.title.localeCompare(b.title));
}

export interface CustomerStockRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  isMultiOriginCustomer: boolean;
  originLocationNames: readonly string[];
  crateCode: string;
  location: string;
  quantity: number;
}

export interface SadaoDailyMovementRow {
  date: string;
  tongCode: string;
  netChange: number;
}

/** Rule 4: daily |net| > multiplier × 30-day avg |net|. */
export function detectSadaoDailySpikes(
  dailyRows: readonly SadaoDailyMovementRow[],
  options?: {
    lookbackDays?: number;
    multiplier?: number;
    minAvgAbs?: number;
  }
): CrateStockAnomaly[] {
  const lookbackDays = options?.lookbackDays ?? SADAO_SPIKE_LOOKBACK_DAYS;
  const multiplier = options?.multiplier ?? SADAO_SPIKE_MULTIPLIER;
  const minAvgAbs = options?.minAvgAbs ?? 1;

  const byType = new Map<string, Map<string, number>>();
  for (const row of dailyRows) {
    const byDate = byType.get(row.tongCode) ?? new Map<string, number>();
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.netChange);
    byType.set(row.tongCode, byDate);
  }

  const anomalies: CrateStockAnomaly[] = [];
  const allDates = Array.from(new Set(dailyRows.map((r) => r.date))).sort();

  for (const [tongCode, byDate] of Array.from(byType.entries())) {
    for (const date of allDates) {
      const net = byDate.get(date);
      if (net == null || net === 0) continue;

      const priorDates = allDates.filter(
        (d) => d < date && d >= shiftDateString(date, -lookbackDays)
      );
      if (priorDates.length === 0) continue;

      const priorAbs = priorDates.map((d) => Math.abs(byDate.get(d) ?? 0));
      const avgAbs =
        priorAbs.reduce((s, n) => s + n, 0) / priorDates.length;
      if (avgAbs < minAvgAbs) continue;

      const threshold = avgAbs * multiplier;
      if (Math.abs(net) <= threshold) continue;

      anomalies.push({
        id: `sadao|${tongCode}|${date}`,
        rule: "sadao_daily_spike",
        ruleLabel: CRATE_STOCK_ANOMALY_RULE_LABELS.sadao_daily_spike,
        severity: "warning",
        title: `${tongCode} · ${date}`,
        detail: `单日净变动 ${net >= 0 ? "+" : ""}${net}，超过近 ${lookbackDays} 天日均绝对变动 ${avgAbs.toFixed(1)} 的 ${multiplier} 倍 (阈值 ${threshold.toFixed(1)})`,
        metadata: {
          tongCode,
          date,
          netChange: net,
          avgAbsDaily: Math.round(avgAbs * 10) / 10,
          threshold: Math.round(threshold * 10) / 10,
          multiplier,
        },
      });
    }
  }

  return anomalies.sort((a, b) =>
    String(b.metadata.date ?? "").localeCompare(String(a.metadata.date ?? ""))
  );
}

function shiftDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateInputValue(d);
}

export interface CustomerLedgerRowWithShipper extends CustomerLedgerRow {
  shipperId: string;
  isMultiOriginCustomer: boolean;
  originLocationNames: readonly string[];
}

export function detectNonStandardLocationsFromRows(input: {
  stockRows: readonly CustomerStockRow[];
  ledgerRows: readonly CustomerLedgerRowWithShipper[];
  ledgerSince: Date;
  agentBusinessLocationsByShipperId?: ReadonlyMap<
    string,
    ReadonlySet<string>
  >;
}): CrateStockAnomaly[] {
  const anomalies: CrateStockAnomaly[] = [];
  const seen = new Set<string>();
  const ledgerCutoff = input.ledgerSince.getTime();

  function agentLocs(shipperId: string) {
    return input.agentBusinessLocationsByShipperId?.get(shipperId);
  }

  function ctxFromStock(row: CustomerStockRow) {
    return buildStandardLocationContext({
      shipperId: row.shipperId,
      shipperCode: row.shipperCode,
      isMultiOriginCustomer: row.isMultiOriginCustomer,
      originLocationNames: row.originLocationNames,
      agentBusinessLocations: agentLocs(row.shipperId),
    });
  }

  function ctxFromLedger(row: CustomerLedgerRowWithShipper) {
    return buildStandardLocationContext({
      shipperId: row.shipperId,
      shipperCode: row.shipperCode,
      isMultiOriginCustomer: row.isMultiOriginCustomer,
      originLocationNames: row.originLocationNames,
      agentBusinessLocations: agentLocs(row.shipperId),
    });
  }

  for (const row of input.stockRows) {
    const ctx = ctxFromStock(row);
    const loc = row.location.trim();
    if (isStandardCustomerStockLocation(loc, ctx)) continue;
    const key = `stock|${row.shipperId}|${row.crateCode}|${loc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    anomalies.push({
      id: `nonstd|${key}`,
      rule: "non_standard_location",
      ruleLabel: CRATE_STOCK_ANOMALY_RULE_LABELS.non_standard_location,
      severity: row.quantity !== 0 ? "warning" : "info",
      title: `${row.shipperCode} · ${row.crateCode} · ${loc || "(空)"}`,
      detail: `customer_crate_stock 非标准 location${row.quantity !== 0 ? ` qty=${row.quantity}` : ""}`,
      metadata: {
        shipperCode: row.shipperCode,
        crateCode: row.crateCode,
        location: loc,
        source: "stock",
        quantity: row.quantity,
      },
    });
  }

  for (const row of input.ledgerRows) {
    if (row.createdAt.getTime() < ledgerCutoff) continue;
    const ctx = ctxFromLedger(row);
    const loc = row.location.trim();
    if (isStandardCustomerStockLocation(loc, ctx)) continue;
    const key = `ledger|${row.shipperId}|${row.crateCode}|${loc}|${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    anomalies.push({
      id: `nonstd|${key}`,
      rule: "non_standard_location",
      ruleLabel: CRATE_STOCK_ANOMALY_RULE_LABELS.non_standard_location,
      severity: "info",
      title: `${row.shipperCode} · ${row.crateCode} · ${loc || "(空)"}`,
      detail: `customer_crate_ledger 新增非标准 location (${row.changeType})`,
      metadata: {
        shipperCode: row.shipperCode,
        crateCode: row.crateCode,
        location: loc,
        source: "ledger",
        changeType: row.changeType,
        ledgerId: row.id,
      },
    });
  }

  return anomalies.sort((a, b) => a.title.localeCompare(b.title));
}

export function mergeCrateStockAnomalies(
  groups: readonly CrateStockAnomaly[][]
): CrateStockAnomaly[] {
  const byId = new Map<string, CrateStockAnomaly>();
  for (const list of groups) {
    for (const item of list) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const rule = a.rule.localeCompare(b.rule);
    if (rule !== 0) return rule;
    return a.title.localeCompare(b.title);
  });
}
