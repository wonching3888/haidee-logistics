import { describe, expect, it } from "vitest";
import {
  buildAgentBusinessLocationsByAgentId,
  buildAgentBusinessLocationsByShipperId,
  buildStandardLocationContext,
  detectDuplicateImportAdjustment,
  detectReturnLocationMismatch,
  detectNonStandardLocationsFromRows,
  detectSadaoDailySpikes,
  isStandardCustomerStockLocation,
  type ImportArrivalRow,
  type StockAdjustmentRow,
} from "./crate-stock-anomalies";

describe("isStandardCustomerStockLocation", () => {
  it("allows empty for non-multi-origin", () => {
    const ctx = buildStandardLocationContext({
      shipperId: "s1",
      shipperCode: "3001-C002",
      isMultiOriginCustomer: false,
      originLocationNames: [],
    });
    expect(isStandardCustomerStockLocation("", ctx)).toBe(true);
    expect(isStandardCustomerStockLocation("TRANG", ctx)).toBe(false);
  });

  it("allows configured origins for multi-origin", () => {
    const ctx = buildStandardLocationContext({
      shipperId: "s1",
      shipperCode: "3000-B002",
      isMultiOriginCustomer: true,
      originLocationNames: ["KRABI", "PHUKET"],
    });
    expect(isStandardCustomerStockLocation("KRABI", ctx)).toBe(true);
    expect(isStandardCustomerStockLocation("TOY", ctx)).toBe(false);
  });

  it("allows pool shipper PATTANI bucket", () => {
    const ctx = buildStandardLocationContext({
      shipperId: "s1",
      shipperCode: "LOC-PATTANI",
      isMultiOriginCustomer: false,
      originLocationNames: [],
    });
    expect(isStandardCustomerStockLocation("PATTANI", ctx)).toBe(true);
    expect(isStandardCustomerStockLocation("TRANG", ctx)).toBe(false);
  });

  it("allows agent business locations inherited from agent ledger", () => {
    const ctx = buildStandardLocationContext({
      shipperId: "member-1",
      shipperCode: "3000-M001",
      isMultiOriginCustomer: false,
      originLocationNames: [],
      agentBusinessLocations: new Set(["RANONG"]),
    });
    expect(isStandardCustomerStockLocation("RANONG", ctx)).toBe(true);
    expect(isStandardCustomerStockLocation("PHUKET", ctx)).toBe(false);
  });
});

describe("detectDuplicateImportAdjustment", () => {
  const baseImport: ImportArrivalRow = {
    id: "imp1",
    plate: "KFR 3888",
    tripDate: new Date("2026-06-25T00:00:00.000Z"),
    tongTypeId: "t-abb",
    tongCode: "ABB",
    quantity: 11,
    arrivedAt: new Date("2026-07-03T08:00:00.000Z"),
    createdAt: new Date("2026-07-03T08:00:00.000Z"),
  };

  const baseAdj: StockAdjustmentRow = {
    id: "adj1",
    tongTypeId: "t-abb",
    tongCode: "ABB",
    quantity: 11,
    date: new Date("2026-07-01T00:00:00.000Z"),
    createdAt: new Date("2026-07-01T04:00:00.000Z"),
    notes: null,
  };

  it("flags matching import and adjustment within 7 days", () => {
    const hits = detectDuplicateImportAdjustment([baseImport], [baseAdj]);
    expect(hits).toHaveLength(1);
    expect(hits[0].rule).toBe("duplicate_import_adjustment");
    expect(hits[0].metadata.plate).toBe("KFR 3888");
  });

  it("ignores opposite-sign quantities (self-correction, not duplicate risk)", () => {
    const hits = detectDuplicateImportAdjustment(
      [{ ...baseImport, quantity: 65 }],
      [{ ...baseAdj, quantity: -65, tongCode: "ABB", tongTypeId: "t-abb" }]
    );
    expect(hits).toHaveLength(0);
  });

  it("marks ambiguous when one adjustment matches multiple trips", () => {
    const sharedAdj: StockAdjustmentRow = {
      id: "adj-shared",
      tongTypeId: "t-vio",
      tongCode: "VIO",
      quantity: 42,
      date: new Date("2026-07-03T00:00:00.000Z"),
      createdAt: new Date("2026-07-03T04:00:00.000Z"),
      notes: null,
    };
    const imports: ImportArrivalRow[] = [
      {
        ...baseImport,
        id: "imp-a",
        plate: "PKS 7679",
        tripDate: new Date("2026-06-01T00:00:00.000Z"),
        tongTypeId: "t-vio",
        tongCode: "VIO",
        quantity: 42,
      },
      {
        ...baseImport,
        id: "imp-b",
        plate: "KFR 3888",
        tripDate: new Date("2026-06-25T00:00:00.000Z"),
        tongTypeId: "t-vio",
        tongCode: "VIO",
        quantity: 42,
      },
    ];
    const hits = detectDuplicateImportAdjustment(imports, [sharedAdj]);
    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(hit.metadata.ambiguousMatch).toBe(1);
      expect(hit.detail).toContain("同时匹配到 2 趟车");
      expect(hit.severity).toBe("info");
    }
  });

  it("keeps warning when trip has both definite and ambiguous crate legs", () => {
    const sharedVioAdj: StockAdjustmentRow = {
      id: "adj-vio-shared",
      tongTypeId: "t-vio",
      tongCode: "VIO",
      quantity: 42,
      date: new Date("2026-07-03T00:00:00.000Z"),
      createdAt: new Date("2026-07-03T04:00:00.000Z"),
      notes: null,
    };
    const uniqueAbbAdj: StockAdjustmentRow = {
      id: "adj-abb-unique",
      tongTypeId: "t-abb",
      tongCode: "ABB",
      quantity: 65,
      date: new Date("2026-07-03T00:00:00.000Z"),
      createdAt: new Date("2026-07-03T04:00:00.000Z"),
      notes: null,
    };
    const kfkImports: ImportArrivalRow[] = [
      {
        ...baseImport,
        id: "imp-kfk-abb",
        plate: "KFK 3888",
        tripDate: new Date("2026-06-27T00:00:00.000Z"),
        tongTypeId: "t-abb",
        tongCode: "ABB",
        quantity: 65,
      },
      {
        ...baseImport,
        id: "imp-kfk-vio",
        plate: "KFK 3888",
        tripDate: new Date("2026-06-27T00:00:00.000Z"),
        tongTypeId: "t-vio",
        tongCode: "VIO",
        quantity: 42,
      },
      {
        ...baseImport,
        id: "imp-pks-vio",
        plate: "PKS 7679",
        tripDate: new Date("2026-06-01T00:00:00.000Z"),
        tongTypeId: "t-vio",
        tongCode: "VIO",
        quantity: 42,
      },
    ];
    const hits = detectDuplicateImportAdjustment(kfkImports, [
      sharedVioAdj,
      uniqueAbbAdj,
    ]);
    const kfk = hits.find((h) => String(h.metadata.plate).includes("KFK"));
    const pks = hits.find((h) => String(h.metadata.plate).includes("PKS"));
    expect(kfk?.severity).toBe("warning");
    expect(kfk?.detail).toContain("同时匹配到 2 趟车");
    expect(kfk?.detail).toContain("ABB为唯一确凿匹配");
    expect(pks?.severity).toBe("info");
  });

  it("ignores when outside 7-day window", () => {
    const hits = detectDuplicateImportAdjustment(
      [baseImport],
      [
        {
          ...baseAdj,
          createdAt: new Date("2026-07-15T00:00:00.000Z"),
        },
      ]
    );
    expect(hits).toHaveLength(0);
  });
});

describe("detectReturnLocationMismatch", () => {
  it("flags export ledger with multiple locations", () => {
    const hits = detectReturnLocationMismatch([
      {
        id: "1",
        shipperCode: "LOC-PATTANI",
        shipperName: "JIAB",
        crateCode: "ABB",
        location: "",
        changeType: "export",
        quantity: -500,
        notes: "TE-20260706-002 export",
        createdAt: new Date("2026-07-06T00:00:00.000Z"),
      },
      {
        id: "2",
        shipperCode: "LOC-PATTANI",
        shipperName: "JIAB",
        crateCode: "ABB",
        location: "PATTANI",
        changeType: "export_void",
        quantity: 500,
        notes: "Void TE-20260706-002",
        createdAt: new Date("2026-07-06T01:00:00.000Z"),
      },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0].metadata.documentNo).toBe("TE-20260706-002");
  });

  it("ignores consistent locations", () => {
    const hits = detectReturnLocationMismatch([
      {
        id: "1",
        shipperCode: "3000-B002",
        shipperName: "BB",
        crateCode: "ABB",
        location: "KRABI",
        changeType: "export",
        quantity: -10,
        notes: "TE-20260707-001",
        createdAt: new Date(),
      },
      {
        id: "2",
        shipperCode: "3000-B002",
        shipperName: "BB",
        crateCode: "ABB",
        location: "KRABI",
        changeType: "export_void",
        quantity: 10,
        notes: "Void TE-20260707-001",
        createdAt: new Date(),
      },
    ]);
    expect(hits).toHaveLength(0);
  });
});

describe("detectNonStandardLocationsFromRows", () => {
  it("returns empty for standard-only stock", () => {
    const hits = detectNonStandardLocationsFromRows({
      stockRows: [
        {
          shipperId: "s1",
          shipperCode: "3001-C002",
          shipperName: "CHUN MENG",
          isMultiOriginCustomer: false,
          originLocationNames: [],
          crateCode: "ABB",
          location: "",
          quantity: 178,
        },
      ],
      ledgerRows: [],
      ledgerSince: new Date("2026-01-01"),
    });
    expect(hits).toHaveLength(0);
  });

  it("flags new non-standard stock location", () => {
    const hits = detectNonStandardLocationsFromRows({
      stockRows: [
        {
          shipperId: "s1",
          shipperCode: "3001-C002",
          shipperName: "CHUN MENG",
          isMultiOriginCustomer: false,
          originLocationNames: [],
          crateCode: "ABB",
          location: "TRANG",
          quantity: 5,
        },
      ],
      ledgerRows: [],
      ledgerSince: new Date("2026-01-01"),
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].metadata.location).toBe("TRANG");
  });

  it("skips agent member location when agent has business activity there", () => {
    const agentId = "agent-1";
    const memberId = "member-1";
    const agentLocs = buildAgentBusinessLocationsByAgentId({
      agentShipperIds: [agentId],
      stockRows: [{ shipperId: agentId, location: "RANONG", quantity: 10 }],
      agentLedgerRows: [],
    });
    const byShipper = buildAgentBusinessLocationsByShipperId({
      agentBusinessLocationsByAgentId: agentLocs,
      memberToAgentId: new Map([[memberId, agentId]]),
    });

    const hits = detectNonStandardLocationsFromRows({
      stockRows: [
        {
          shipperId: memberId,
          shipperCode: "3000-M001",
          shipperName: "Member",
          isMultiOriginCustomer: false,
          originLocationNames: [],
          crateCode: "ABB",
          location: "RANONG",
          quantity: 3,
        },
      ],
      ledgerRows: [],
      ledgerSince: new Date("2026-01-01"),
      agentBusinessLocationsByShipperId: byShipper,
    });
    expect(hits).toHaveLength(0);
  });
});

describe("detectSadaoDailySpikes", () => {
  it("flags day exceeding 3x rolling average", () => {
    const rows = [];
    for (let d = 1; d <= 31; d++) {
      const day = String(d).padStart(2, "0");
      rows.push({
        date: `2026-06-${day}`,
        tongCode: "ABB",
        netChange: d === 30 ? 5 : 1,
      });
    }
    rows.push({ date: "2026-07-01", tongCode: "ABB", netChange: 50 });

    const hits = detectSadaoDailySpikes(rows, {
      lookbackDays: 30,
      multiplier: 3,
      minAvgAbs: 1,
    });
    const jul1 = hits.find((h) => h.metadata.date === "2026-07-01");
    expect(jul1).toBeDefined();
  });
});
