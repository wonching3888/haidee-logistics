import { describe, expect, it } from "vitest";
import {
  buildInvoiceCollectionsUrlScopeKey,
  isDetailDataForUrlScope,
} from "./invoice-collections-detail";

describe("isDetailDataForUrlScope", () => {
  it("matches when detail customerKey and currency equal URL scope", () => {
    expect(
      isDetailDataForUrlScope(
        { customerKey: "shipper:abc", currency: "THB" },
        "shipper:abc",
        "THB"
      )
    ).toBe(true);
  });

  it("rejects stale detail when URL customer differs", () => {
    expect(
      isDetailDataForUrlScope(
        { customerKey: "shipper:b", currency: "THB" },
        "shipper:a",
        "THB"
      )
    ).toBe(false);
  });

  it("rejects when currency differs", () => {
    expect(
      isDetailDataForUrlScope(
        { customerKey: "shipper:a", currency: "MYR" },
        "shipper:a",
        "THB"
      )
    ).toBe(false);
  });

  it("rejects missing URL scope", () => {
    expect(
      isDetailDataForUrlScope(
        { customerKey: "shipper:a", currency: "THB" },
        null,
        "THB"
      )
    ).toBe(false);
  });
});

describe("buildInvoiceCollectionsUrlScopeKey", () => {
  it("includes customer, currency, and month range", () => {
    expect(
      buildInvoiceCollectionsUrlScopeKey({
        customerKey: "shipper:x",
        currency: "MYR",
        fromYear: 2026,
        fromMonth: 1,
        toYear: 2026,
        toMonth: 6,
      })
    ).toBe("shipper:x|MYR|2026|1|2026|6");
  });
});
