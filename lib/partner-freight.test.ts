import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPartnerInvoiceNo } from "@/lib/partner-freight";
import { isLogisticsPartnerShipper, SHIPPER_KIND } from "@/lib/constants/shipper-kind";

describe("partner freight helpers", () => {
  it("formats EXP invoice numbers with monthly sequence", () => {
    assert.equal(formatPartnerInvoiceNo(2026, 6, 1), "EXP-2606-001");
    assert.equal(formatPartnerInvoiceNo(2026, 6, 12), "EXP-2606-012");
  });

  it("detects logistics partner shippers", () => {
    assert.equal(
      isLogisticsPartnerShipper({ shipperKind: SHIPPER_KIND.LOGISTICS_PARTNER }),
      true
    );
    assert.equal(
      isLogisticsPartnerShipper({ shipperKind: SHIPPER_KIND.OPERATIONAL }),
      false
    );
  });
});
