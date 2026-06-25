/**
 * June snapshot report formatting (Step 5 shadow).
 */
import type {
  LegDetailRow,
  MileageAuditIssue,
  TripVehicleShadowCompare,
  VoucherGateShadowCompare,
} from "@/lib/trip-cost-engine/shadow-compare";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function fmt(n: number) {
  return n.toFixed(2);
}

export interface TripShadowSnapshotRow {
  tripId: string;
  date: string;
  truckPlate: string;
  routeLabel: string;
  routeGroups: string[];
  marketQuantities: Record<string, number>;
  voucherStatus: string | null;
  vehicle: TripVehicleShadowCompare;
  voucherGate: VoucherGateShadowCompare;
  featured: boolean;
  featuredLabel?: string;
}

export interface MonthShadowSummary {
  year: number;
  month: number;
  tripCount: number;
  conservationPassCount: number;
  conservationFailCount: number;
  legacyVehicleTotalMyr: number;
  enforcedVehicleTotalMyr: number;
  vehicleTotalDeltaMyr: number;
  voucherGateChangedCount: number;
  mileageIssues: MileageAuditIssue[];
  trips: TripShadowSnapshotRow[];
  featuredTrips: TripShadowSnapshotRow[];
  conservationFailures: TripShadowSnapshotRow[];
}

export function formatLegDetailMarkdown(leg: LegDetailRow): string {
  const lines = [
    `#### Leg ${leg.legIndex + 1}: SADAO→${leg.toRouteGroup}（双程 ${fmt(leg.distanceKm)} km）`,
    `- 段成本：油 ${fmt(leg.legFuelMyr)} + 维保 ${fmt(leg.legMaintenanceMyr)} + 过路 ${fmt(leg.legTollMyr)}`,
    "",
    "| 市场组 | 桶数 | 油 | 维保 | 过路 | 段内合计 |",
    "|--------|------|-----|------|------|----------|",
  ];
  for (const row of leg.byRouteGroup) {
    lines.push(
      `| ${row.routeGroup} | ${row.quantity} | ${fmt(row.fuelMyr)} | ${fmt(row.maintenanceMyr)} | ${fmt(row.tollMyr)} | ${fmt(row.variableMyr)} |`
    );
  }
  return lines.join("\n");
}

export function formatFeaturedTripMarkdown(trip: TripShadowSnapshotRow): string {
  const v = trip.vehicle;
  const lines = [
    `### ${trip.featuredLabel ?? trip.routeLabel} — ${trip.date} ${trip.truckPlate}`,
    `- tripId: \`${trip.tripId}\``,
    `- 市场组: ${trip.routeGroups.join(" / ")}`,
    `- 桶数: ${Object.entries(trip.marketQuantities)
      .map(([m, q]) => `${m}=${q}`)
      .join(", ")}`,
    `- 里程口径: ${v.mileageNote}`,
    `- 油单价: ${v.fuelPerKmMyr != null ? fmt(v.fuelPerKmMyr) : "—"} MYR/km；维保单价: ${v.maintenancePerKmMyr != null ? fmt(v.maintenancePerKmMyr) : "—"} MYR/km`,
    "",
    "**守恒（整车池 legacy vs enforced）**",
    `| 项目 | Legacy | Enforced |`,
    `|------|--------|----------|`,
    `| 油 | ${fmt(v.legacy.fuelMyr)} | ${fmt(v.enforced.fuelMyr)} |`,
    `| 维保 | ${fmt(v.legacy.maintenanceMyr)} | ${fmt(v.enforced.maintenanceMyr)} |`,
    `| 过路 | ${fmt(v.legacy.tollMyr)} | ${fmt(v.enforced.tollMyr)} |`,
    `| 全局费 | ${fmt(v.legacy.globalMyr)} | ${fmt(v.enforced.globalMyr)} |`,
    `| **合计** | **${fmt(v.legacy.totalMyr)}** | **${fmt(v.enforced.totalMyr)}** | Δ=${fmt(v.conservationDeltaMyr)} ${v.conservationOk ? "✓" : "✗"} |`,
    "",
    "**各市场可变成本（油+维保+过路，不含全局费）**",
    "| 市场 | 桶数 | Legacy | Enforced | Δ |",
    "|------|------|--------|----------|---|",
  ];

  for (const m of v.markets) {
    lines.push(
      `| ${m.routeGroup} | ${m.quantity} | ${fmt(m.legacyVariableMyr)} | ${fmt(m.enforcedVariableMyr)} | ${fmt(m.enforcedVariableMyr - m.legacyVariableMyr)} |`
    );
  }

  lines.push("", "**分段明细**");
  for (const leg of v.legDetails) {
    lines.push("", formatLegDetailMarkdown(leg));
  }

  if (trip.voucherGate.gateWouldChange) {
    lines.push(
      "",
      `**成本闸门(A)**：voucher=${trip.voucherStatus ?? "无"}；装卸费 legacy ${fmt(trip.voucherGate.legacyLoadUnloadMyr)} → enforced ${fmt(trip.voucherGate.enforcedLoadUnloadMyr)} (Δ ${fmt(trip.voucherGate.deltaMyr)})`
    );
  }

  return lines.join("\n");
}

export function formatShadowMarkdownReport(summary: MonthShadowSummary): string {
  const lines = [
    `# 2026年${summary.month}月 成本影子核对报告（Step 5 Shadow）`,
    "",
    "> 生产输出仍为 **legacy**；本报告仅对比 legacy vs leg-based enforced。",
    "> 里程：`sadoo_mileage_km` 为 **双程(来回)**；单价为每实际行驶 km。",
    "",
    "## 全月汇总",
    "",
    `| 指标 | 值 |`,
    `|------|-----|`,
    `| 趟次数 | ${summary.tripCount} |`,
    `| 守恒通过 | ${summary.conservationPassCount} |`,
    `| 守恒失败 | ${summary.conservationFailCount} |`,
    `| Legacy 车辆池合计 | ${fmt(summary.legacyVehicleTotalMyr)} MYR |`,
    `| Enforced 车辆池合计 | ${fmt(summary.enforcedVehicleTotalMyr)} MYR |`,
    `| 差额 | ${fmt(summary.vehicleTotalDeltaMyr)} MYR |`,
    `| 闸门(A)有差异趟次 | ${summary.voucherGateChangedCount} |`,
    "",
  ];

  if (summary.mileageIssues.length > 0) {
    lines.push("## 里程主数据体检", "");
    lines.push("| 市场组 | 问题 | 里程km | 说明 |");
    lines.push("|--------|------|--------|------|");
    for (const issue of summary.mileageIssues) {
      lines.push(
        `| ${issue.routeGroup} | ${issue.issue} | ${issue.sadooMileageKm ?? "—"} | ${issue.detail} |`
      );
    }
    lines.push("");
  } else {
    lines.push("## 里程主数据体检", "", "✓ KD < BM < A < KL < MC 顺序检查通过（有数据的市场组）", "");
  }

  lines.push("## ★ 老板核对：三种典型路线", "");

  const featuredLabels = new Set(
    summary.featuredTrips.map((t) => t.featuredLabel).filter(Boolean)
  );
  const expectedFeatured = [
    "BM+MC（两段）",
    "KL+MC（两段，KL近MC远）",
    "KL+BM+A（三段，BM→A→KL卸货顺序）",
  ];
  const missingFeatured = expectedFeatured.filter((l) => !featuredLabels.has(l));
  if (missingFeatured.length > 0) {
    lines.push(
      `> **本月缺失样本**：${missingFeatured.join("、")}（6月真实趟次中未出现，无法反推；可用其他月份或手工造样补核）`,
      ""
    );
  }

  if (summary.featuredTrips.length === 0) {
    lines.push("_本月未找到 BM+MC / KL+MC / KL+BM+A 完整样本趟次。_");
  } else {
    for (const trip of summary.featuredTrips) {
      lines.push(formatFeaturedTripMarkdown(trip), "");
    }
  }

  if (summary.conservationFailures.length > 0) {
    lines.push("## 守恒异常趟次", "");
    lines.push("| 日期 | 车牌 | 路线 | Legacy | Enforced | Δ |");
    lines.push("|------|------|------|--------|----------|---|");
    for (const trip of summary.conservationFailures) {
      lines.push(
        `| ${trip.date} | ${trip.truckPlate} | ${trip.routeLabel} | ${fmt(trip.vehicle.legacy.totalMyr)} | ${fmt(trip.vehicle.enforced.totalMyr)} | ${fmt(trip.vehicle.conservationDeltaMyr)} |`
      );
    }
    lines.push("");
  }

  lines.push("## 全月趟次清单（车辆池对比）", "");
  lines.push(
    "| 日期 | 车牌 | 路线 | Legacy池 | Enforced池 | 守恒 | 闸门Δ |",
    "|------|------|------|----------|------------|------|-------|"
  );
  for (const trip of summary.trips) {
    lines.push(
      `| ${trip.date} | ${trip.truckPlate} | ${trip.routeLabel} | ${fmt(trip.vehicle.legacy.totalMyr)} | ${fmt(trip.vehicle.enforced.totalMyr)} | ${trip.vehicle.conservationOk ? "✓" : "✗"} | ${trip.voucherGate.gateWouldChange ? fmt(trip.voucherGate.deltaMyr) : "—"} |`
    );
  }

  return lines.join("\n");
}

export function buildMonthShadowSummary(
  trips: TripShadowSnapshotRow[],
  mileageIssues: MileageAuditIssue[],
  year: number,
  month: number
): MonthShadowSummary {
  let legacyVehicleTotalMyr = 0;
  let enforcedVehicleTotalMyr = 0;
  let conservationPassCount = 0;
  let conservationFailCount = 0;
  let voucherGateChangedCount = 0;

  for (const trip of trips) {
    legacyVehicleTotalMyr += trip.vehicle.legacy.totalMyr;
    enforcedVehicleTotalMyr += trip.vehicle.enforced.totalMyr;
    if (trip.vehicle.conservationOk) conservationPassCount++;
    else conservationFailCount++;
    if (trip.voucherGate.gateWouldChange) voucherGateChangedCount++;
  }

  return {
    year,
    month,
    tripCount: trips.length,
    conservationPassCount,
    conservationFailCount,
    legacyVehicleTotalMyr: roundMoney(legacyVehicleTotalMyr),
    enforcedVehicleTotalMyr: roundMoney(enforcedVehicleTotalMyr),
    vehicleTotalDeltaMyr: roundMoney(
      enforcedVehicleTotalMyr - legacyVehicleTotalMyr
    ),
    voucherGateChangedCount,
    mileageIssues,
    trips,
    featuredTrips: trips.filter((t) => t.featured),
    conservationFailures: trips.filter((t) => !t.vehicle.conservationOk),
  };
}

export function classifyFeaturedRoute(
  routeGroups: string[]
): { featured: boolean; label?: string } {
  const set = new Set(routeGroups);
  const has = (g: string) => set.has(g);

  if (has("BM") && has("MC") && set.size === 2) {
    return { featured: true, label: "BM+MC（两段）" };
  }
  if (has("KL") && has("MC") && set.size === 2) {
    return { featured: true, label: "KL+MC（两段，KL近MC远）" };
  }
  if (has("KL") && has("BM") && has("A") && set.size === 3) {
    return { featured: true, label: "KL+BM+A（三段，BM→A→KL卸货顺序）" };
  }
  return { featured: false };
}
