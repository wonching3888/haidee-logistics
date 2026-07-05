import { describe, expect, it } from "vitest";
import {
  canAccessPage,
  isThaiCostMonthlySummaryPath,
} from "@/lib/page-access";

describe("thai cost monthly summary access", () => {
  const summaryPaths = [
    "/thai-cost/sadao-summary",
    "/thai-cost/songkhla-summary",
    "/thai-cost/pattani-summary",
    "/thai-cost/monthly-summary",
  ];

  it.each(summaryPaths)("detects %s as monthly summary path", (path) => {
    expect(isThaiCostMonthlySummaryPath(path)).toBe(true);
    expect(isThaiCostMonthlySummaryPath(`${path}?year=2026&month=6`)).toBe(
      true
    );
  });

  it("clerk cannot access monthly summary pages", () => {
    for (const path of summaryPaths) {
      expect(canAccessPage("clerk", path)).toBe(false);
    }
  });

  it("clerk can still access data entry and daily overview", () => {
    expect(canAccessPage("clerk", "/thai-cost/attendance")).toBe(true);
    expect(canAccessPage("clerk", "/thai-cost/data-entry")).toBe(true);
    expect(canAccessPage("clerk", "/thai-cost/daily-overview")).toBe(true);
    expect(canAccessPage("clerk", "/thai-cost/sadao-handling")).toBe(true);
  });

  it("thai_accounting can access monthly summary", () => {
    for (const path of summaryPaths) {
      expect(canAccessPage("thai_accounting", path)).toBe(true);
    }
  });

  it("admin can access monthly summary", () => {
    for (const path of summaryPaths) {
      expect(canAccessPage("admin", path)).toBe(true);
    }
  });
});
