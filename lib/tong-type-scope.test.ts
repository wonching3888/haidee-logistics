import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TONG_IMPORT_ALL_COLUMNS } from "@/lib/constants/tong-import-columns";
import { DO_TONG_COLUMNS } from "@/lib/constants/tong-columns";

describe("SKTN crate type scope", () => {
  it("includes SKTN in empty-crate import column mapping", () => {
    const sktn = TONG_IMPORT_ALL_COLUMNS.find((col) => col.key === "SKTN");
    assert.deepEqual(sktn, {
      key: "SKTN",
      label: "SKTN",
      tongCode: "SKTN",
    });
  });

  it("excludes SKTN from D/O print column list", () => {
    assert.equal(
      DO_TONG_COLUMNS.some((col) => col.code === "SKTN"),
      false
    );
  });

  it("keeps canonical inbound crate columns unchanged except SKTN insert after GLY", () => {
    const codes = TONG_IMPORT_ALL_COLUMNS.map((col) => col.key);
    assert.deepEqual(codes, [
      "ABB",
      "WTL",
      "BHR",
      "VIO",
      "MAR",
      "SHK",
      "GKS",
      "BRO",
      "GLY",
      "SKTN",
      "BS",
      "BH",
      "SHS",
    ]);
  });
});
