import { describe, expect, it } from "vitest";
import {
  computeSadaoStockByTongType,
  computeTongStockDeltaForTarget,
} from "./sadao-stock";

const TONG_TYPES = [
  { id: "t1", code: "ABB", name: "ABB" },
  { id: "t2", code: "WTL", name: "WTL" },
];

describe("computeSadaoStockByTongType", () => {
  it("equals imports minus exports when adjustments are empty", () => {
    const stock = computeSadaoStockByTongType({
      tongTypes: TONG_TYPES,
      importQtyByTongTypeId: { t1: 100, t2: 50 },
      exportQtyByTongTypeId: { t1: 30, t2: 10 },
      adjustmentQtyByTongTypeId: {},
    });

    expect(stock.ABB.stock).toBe(70);
    expect(stock.WTL.stock).toBe(40);
  });

  it("omits adjustment map entirely (undefined) same as zero adjustments", () => {
    const withEmpty = computeSadaoStockByTongType({
      tongTypes: TONG_TYPES,
      importQtyByTongTypeId: { t1: 80 },
      exportQtyByTongTypeId: { t1: 20 },
      adjustmentQtyByTongTypeId: {},
    });
    const withoutKey = computeSadaoStockByTongType({
      tongTypes: TONG_TYPES,
      importQtyByTongTypeId: { t1: 80 },
      exportQtyByTongTypeId: { t1: 20 },
    });

    expect(withEmpty.ABB.stock).toBe(60);
    expect(withoutKey.ABB.stock).toBe(60);
  });

  it("adds summed adjustment deltas per tong type", () => {
    const stock = computeSadaoStockByTongType({
      tongTypes: TONG_TYPES,
      importQtyByTongTypeId: { t1: 10 },
      exportQtyByTongTypeId: { t1: 4 },
      adjustmentQtyByTongTypeId: { t1: 100 },
    });

    expect(stock.ABB.stock).toBe(106);
  });

  it("defaults missing import/export to zero", () => {
    const stock = computeSadaoStockByTongType({
      tongTypes: TONG_TYPES,
      importQtyByTongTypeId: {},
      exportQtyByTongTypeId: {},
      adjustmentQtyByTongTypeId: { t2: 25 },
    });

    expect(stock.ABB.stock).toBe(0);
    expect(stock.WTL.stock).toBe(25);
  });
});

describe("computeTongStockDeltaForTarget", () => {
  it("returns zero when target equals current", () => {
    expect(computeTongStockDeltaForTarget(80, 80)).toBe(0);
  });

  it("returns positive delta for opening stock increase", () => {
    expect(computeTongStockDeltaForTarget(0, 100)).toBe(100);
  });

  it("returns negative delta for stocktake decrease", () => {
    expect(computeTongStockDeltaForTarget(100, 80)).toBe(-20);
  });
});
