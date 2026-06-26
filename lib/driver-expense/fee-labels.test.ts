import { describe, expect, it } from "vitest";
import {
  formatKpbFeeRowLabel,
  getKpbFeeLabel,
} from "@/lib/driver-expense/fee-labels";

describe("getKpbFeeLabel", () => {
  it("returns bilingual parking label for Ipoh (A)", () => {
    expect(getKpbFeeLabel("A", "zh")).toBe("停车费 Parking");
    expect(getKpbFeeLabel("a", "zh")).toBe("停车费 Parking");
    expect(getKpbFeeLabel("A", "th")).toBe("ค่าจอดรถ Parking");
  });

  it("returns KPB for other markets", () => {
    expect(getKpbFeeLabel("KL", "zh")).toBe("KPB");
    expect(getKpbFeeLabel("BM", "th")).toBe("KPB");
    expect(getKpbFeeLabel("MC", "zh")).toBe("KPB");
  });
});

describe("formatKpbFeeRowLabel", () => {
  it("appends market code", () => {
    expect(formatKpbFeeRowLabel("A", "zh")).toBe("停车费 Parking A");
    expect(formatKpbFeeRowLabel("BM", "zh")).toBe("KPB BM");
  });
});
