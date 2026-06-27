import { describe, expect, it } from "vitest";
import {
  CRATE_IMPORT_NO_RETURN_NOTE,
  deriveCrateImportRowState,
  emptyCrateImportQuantities,
  mergeImportRowsWithDispatch,
  shouldPersistCrateImportRow,
} from "@/lib/crate-import-rows";

describe("mergeImportRowsWithDispatch", () => {
  it("seeds empty rows for all dispatched trucks when no imports exist", () => {
    const rows = mergeImportRowsWithDispatch([], ["A", "B", "C"], {
      B: "KL",
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.truckPlate)).toEqual(["A", "B", "C"]);
    expect(rows[1]?.marketCode).toBe("KL");
    expect(rows[0]?.quantities.ABB).toBe("");
  });

  it("keeps import rows and still adds missing dispatched trucks after partial save", () => {
    const existing = [
      {
        truckPlate: "T1",
        marketCode: "KL",
        quantities: { ...emptyCrateImportQuantities(), ABB: "5" },
        notes: "",
        status: "on_the_way" as const,
      },
    ];
    const rows = mergeImportRowsWithDispatch(existing, ["T1", "T2", "T3"]);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.quantities.ABB).toBe("5");
    expect(rows[1]?.truckPlate).toBe("T2");
    expect(rows[1]?.marketCode).toBe("");
    expect(rows[2]?.truckPlate).toBe("T3");
  });

  it("preserves manual import rows for plates not on dispatch list", () => {
    const existing = [
      {
        truckPlate: "EXTRA",
        marketCode: "MC",
        quantities: emptyCrateImportQuantities(),
        notes: "",
        status: "arrived" as const,
      },
    ];
    const rows = mergeImportRowsWithDispatch(existing, ["T1"]);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.truckPlate).toBe("EXTRA");
  });
});

describe("deriveCrateImportRowState", () => {
  it("detects recorded, pending, and no_return states", () => {
    const qty = emptyCrateImportQuantities();
    expect(
      deriveCrateImportRowState({
        truckPlate: "T1",
        marketCode: "KL",
        quantities: { ...qty, ABB: "2" },
        notes: "",
        status: "on_the_way",
      })
    ).toBe("recorded");

    expect(
      deriveCrateImportRowState({
        truckPlate: "T1",
        marketCode: "",
        quantities: qty,
        notes: "",
        status: "on_the_way",
      })
    ).toBe("pending");

    expect(
      deriveCrateImportRowState({
        truckPlate: "T1",
        marketCode: "KL",
        quantities: qty,
        notes: CRATE_IMPORT_NO_RETURN_NOTE,
        status: "arrived",
        noReturn: true,
      })
    ).toBe("no_return");
  });
});

describe("shouldPersistCrateImportRow", () => {
  it("persists no_return and qty rows only when market is set", () => {
    const qty = emptyCrateImportQuantities();
    expect(
      shouldPersistCrateImportRow({
        truckPlate: "T1",
        marketCode: "KL",
        quantities: qty,
        notes: "",
        status: "on_the_way",
        noReturn: true,
      })
    ).toBe(true);
    expect(
      shouldPersistCrateImportRow({
        truckPlate: "T1",
        marketCode: "",
        quantities: qty,
        notes: "",
        status: "on_the_way",
        noReturn: true,
      })
    ).toBe(false);
    expect(
      shouldPersistCrateImportRow({
        truckPlate: "T1",
        marketCode: "KL",
        quantities: { ...qty, ABB: "1" },
        notes: "",
        status: "on_the_way",
      })
    ).toBe(true);
    expect(
      shouldPersistCrateImportRow({
        truckPlate: "T1",
        marketCode: "KL",
        quantities: qty,
        notes: "",
        status: "on_the_way",
      })
    ).toBe(false);
  });
});
