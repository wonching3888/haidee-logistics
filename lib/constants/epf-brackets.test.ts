import { describe, expect, it } from "vitest";
import { EPF_BRACKETS, lookupEpfContributions } from "@/lib/constants/epf-brackets";

/** June 2026 verified anchors (accounting = official Part A). */
const JUNE_2026_ANCHORS: Array<{
  name: string;
  gross: number;
  employer: number;
  employee: number;
}> = [
  { name: "Halim", gross: 3550, employer: 463, employee: 392 },
  { name: "Awang", gross: 4790, employer: 624, employee: 528 },
  { name: "Azrin", gross: 4090, employer: 533, employee: 451 },
  { name: "Wan", gross: 4790, employer: 624, employee: 528 },
  { name: "Own", gross: 4150, employer: 541, employee: 458 },
  { name: "Rozaime", gross: 4150, employer: 541, employee: 458 },
  { name: "Fook", gross: 4510, employer: 588, employee: 498 },
  { name: "Faizal", gross: 4650, employer: 606, employee: 513 },
  { name: "Akim", gross: 4630, employer: 604, employee: 511 },
  { name: "Naim", gross: 4830, employer: 630, employee: 533 },
  { name: "Azhar", gross: 4730, employer: 617, employee: 522 },
  { name: "Pinat", gross: 5040, employer: 612, employee: 561 },
  { name: "Din", gross: 920, employer: 120, employee: 102 },
  { name: "Ikmal", gross: 4610, employer: 601, employee: 509 },
];

describe("EPF Third Schedule Part A official brackets", () => {
  it("has 401 wage tiers up to RM20000", () => {
    expect(EPF_BRACKETS).toHaveLength(401);
    expect(EPF_BRACKETS[EPF_BRACKETS.length - 1]).toEqual({
      wageTo: 20000,
      employer: 2400,
      employee: 2200,
    });
  });

  it("floor anchor: wage <= 10 → TIADA (0/0)", () => {
    expect(lookupEpfContributions(0)).toEqual({ employer: 0, employee: 0 });
    expect(lookupEpfContributions(10)).toEqual({ employer: 0, employee: 0 });
  });

  it("KWSP official example: wage 3250 → employer 424 / employee 359", () => {
    expect(lookupEpfContributions(3250)).toEqual({
      employer: 424,
      employee: 359,
    });
  });

  it("employer rate break: 5000 uses 13% band, 5000.01 uses 12% band", () => {
    expect(lookupEpfContributions(5000)).toEqual({
      employer: 650,
      employee: 550,
    });
    expect(lookupEpfContributions(5000.01)).toEqual({
      employer: 612,
      employee: 561,
    });
  });

  it("percentage path only above RM20000", () => {
    expect(lookupEpfContributions(20000)).toEqual({
      employer: 2400,
      employee: 2200,
    });
    // 20001 × 12% = 2400.12 → ceil next ringgit 2401; × 11% = 2200.11 → 2201
    expect(lookupEpfContributions(20001)).toEqual({
      employer: 2401,
      employee: 2201,
    });
  });

  for (const row of JUNE_2026_ANCHORS) {
    it(`${row.name} June gross ${row.gross} → ${row.employer}/${row.employee}`, () => {
      expect(lookupEpfContributions(row.gross)).toEqual({
        employer: row.employer,
        employee: row.employee,
      });
    });
  }
});
