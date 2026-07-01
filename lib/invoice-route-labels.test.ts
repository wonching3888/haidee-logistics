import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAllInvoiceRouteLabels,
  getInvoiceRouteLabel,
  getMode1aInvoiceRouteLabel,
  INVOICE_MARKET_SHORT_NAMES,
  INVOICE_ROUTE_MARKET_CODES,
  INVOICE_ROUTE_PREFIX,
} from "./constants/invoice-route-labels";

describe("invoice route labels", () => {
  it("maps all 14 invoice markets to confirmed short names", () => {
    const expected: Record<string, string> = {
      KL: "SELAYANG",
      BP: "BATU PAHAT",
      MP: "MUAR",
      SL: "SEREMBAN",
      MC: "MELAKA",
      A: "IPOH",
      BM: "BUKIT MERTAJAM",
      P: "PENANG",
      TP: "TAIPING",
      NT: "NIBONG TEBAL",
      KT: "TANJUNG PIANDANG",
      SA: "SIMPANG AMPAT",
      KD: "KEDAH",
      JB: "JOHOR BAHRU",
    };

    for (const code of INVOICE_ROUTE_MARKET_CODES) {
      assert.equal(INVOICE_MARKET_SHORT_NAMES[code], expected[code]);
      assert.equal(
        getInvoiceRouteLabel(code),
        `${INVOICE_ROUTE_PREFIX}${expected[code]}`
      );
    }

    const all = buildAllInvoiceRouteLabels();
    assert.equal(Object.keys(all).length, 14);
  });

  it("builds mode 1a SADAO TO place-name routes", () => {
    assert.equal(getMode1aInvoiceRouteLabel("KL"), "SADAO TO SELAYANG");
    assert.equal(getMode1aInvoiceRouteLabel("A"), "SADAO TO IPOH");
    assert.equal(getMode1aInvoiceRouteLabel("P"), "SADAO TO PENANG");
    assert.equal(getMode1aInvoiceRouteLabel("KD"), "SADAO TO KEDAH");
  });
});
