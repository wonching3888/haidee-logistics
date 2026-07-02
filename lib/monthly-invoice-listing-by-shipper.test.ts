import { describe, expect, it } from "vitest";
import { getMode2InvoiceRouteLabel } from "@/lib/constants/invoice-route-labels";
import {
  buildInvoiceListing,
  buildInvoiceListingByShipper,
  INVOICE_LISTING_CRATE_SECTION_TITLE,
} from "@/lib/monthly-invoice-aggregate";
import type { RawInvoiceLine } from "@/lib/monthly-invoice";

function rawLine(
  input: Partial<RawInvoiceLine> & Pick<RawInvoiceLine, "shipperId">
): RawInvoiceLine {
  return {
    sessionDate: new Date("2026-06-08T00:00:00.000Z"),
    stallMarketCode: "KL",
    stallCode: "S1",
    stallName: null,
    tongTypeCode: "ABB",
    quantity: 1,
    freightRate: 40,
    freightAmount: 40,
    isBox: false,
    shipperId: input.shipperId,
    shipperCode: input.shipperCode ?? "3001-A001",
    shipperName: input.shipperName ?? "SHIPPER A",
    consigneeId: "c1",
    consigneeCode: "3002-N002",
    consigneeName: "WEI SHENG",
    ...input,
  };
}

describe("getMode2InvoiceRouteLabel", () => {
  it("uses BUKIT KAYU HITAM TO with full market display name", () => {
    expect(getMode2InvoiceRouteLabel("KL")).toBe("BUKIT KAYU HITAM TO SELAYANG");
    expect(getMode2InvoiceRouteLabel("BM")).toBe(
      "BUKIT KAYU HITAM TO BUKIT MERTAJAM"
    );
  });
});

describe("buildInvoiceListingByShipper", () => {
  it("groups lines by shipper and matches flat listing totals", () => {
    const lines = [
      rawLine({
        shipperId: "s1",
        shipperCode: "3001-B001",
        shipperName: "BROTHER",
        quantity: 5,
        freightAmount: 200,
      }),
      rawLine({
        shipperId: "s2",
        shipperCode: "3001-A001",
        shipperName: "ARSAN",
        sessionDate: new Date("2026-06-09T00:00:00.000Z"),
        quantity: 3,
        freightAmount: 120,
      }),
      rawLine({
        shipperId: "s1",
        shipperCode: "3001-B001",
        shipperName: "BROTHER",
        sessionDate: new Date("2026-06-09T00:00:00.000Z"),
        quantity: 2,
        freightAmount: 80,
      }),
    ];

    const flat = buildInvoiceListing(lines);
    const grouped = buildInvoiceListingByShipper(lines);

    expect(grouped.shipperGroups).toHaveLength(2);
    expect(grouped.shipperGroups[0]?.shipperCode).toBe("3001-A001");
    expect(grouped.shipperGroups[1]?.shipperCode).toBe("3001-B001");
    expect(grouped.overallTotalQty).toBe(10);
    expect(flat.sections[0]?.grandTotal).toBe(10);
    expect(grouped.shipperGroups[1]?.groupTotalQty).toBe(7);
    expect(grouped.shipperGroups[0]?.listing.sections[0]?.title).toBe(
      INVOICE_LISTING_CRATE_SECTION_TITLE
    );
    expect(grouped.shipperGroups[0]?.listing.sections[0]?.title).not.toContain(
      "Tong"
    );
  });
});
