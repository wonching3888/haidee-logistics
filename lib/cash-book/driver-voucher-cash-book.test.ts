import { describe, expect, it } from "vitest";
import {
  buildDriverVoucherParticulars,
  buildDriverVoucherSettlementLines,
} from "@/lib/cash-book/driver-voucher-cash-book";
import { PaymentVoucherValidationError } from "@/lib/cash-book/payment-voucher-lines";

describe("buildDriverVoucherSettlementLines", () => {
  const particulars = "Halim / KFW 3888 / 2026-07-14";

  it("maps each belanja actual to its account and skips zeros", () => {
    const lines = buildDriverVoucherSettlementLines({
      chopBorderActual: 10,
      fishCheckActual: 0,
      kpbActual: 20,
      upahTurunActual: 30,
      upahNaikTongActual: 5,
      parkingActual: null,
      minyakMotoEnabled: true,
      minyakMotoActual: 8,
      otherActual: 2,
      particulars,
    });

    expect(lines.map((l) => [l.accountCode, l.amount])).toEqual([
      ["6301-0000", 10],
      ["6303-0000", 20],
      ["6304-0000", 35],
      ["6306-0000", 10],
    ]);
  });

  it("merges upah fields into one 6304 line and minyak+other into 6306", () => {
    const lines = buildDriverVoucherSettlementLines({
      upahTurunActual: 100,
      upahNaikTongActual: 25.5,
      minyakMotoEnabled: true,
      minyakMotoActual: 8,
      otherActual: 1.5,
      particulars,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ accountCode: "6304-0000", amount: 125.5 });
    expect(lines[1]).toMatchObject({ accountCode: "6306-0000", amount: 9.5 });
  });

  it("ignores minyak when checkbox is off", () => {
    const lines = buildDriverVoucherSettlementLines({
      parkingActual: 12,
      minyakMotoEnabled: false,
      minyakMotoActual: 8,
      otherActual: 3,
      particulars,
    });
    expect(lines.map((l) => [l.accountCode, l.amount])).toEqual([
      ["6305-0000", 12],
      ["6306-0000", 3],
    ]);
  });

  it("throws when every actual is empty/zero", () => {
    expect(() =>
      buildDriverVoucherSettlementLines({
        chopBorderActual: 0,
        particulars,
      })
    ).toThrow(PaymentVoucherValidationError);
  });
});

describe("buildDriverVoucherParticulars", () => {
  it("joins driver, plate, and trip date", () => {
    expect(
      buildDriverVoucherParticulars({
        driverName: "Halim",
        lorry: "KFW 3888",
        tripDate: "2026-07-14",
      })
    ).toBe("Halim / KFW 3888 / 2026-07-14");
  });
});
