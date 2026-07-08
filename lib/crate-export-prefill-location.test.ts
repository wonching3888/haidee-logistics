import { describe, expect, it } from "vitest";
import type { CrateExportPrefillTarget } from "@/lib/crate-export-due-today";
import {
  resolveStandalonePrefillOriginAfterConfig,
  standalonePrefillOriginLocation,
} from "@/lib/crate-export-prefill-location";

const standaloneMulti: CrateExportPrefillTarget = {
  mode: "standalone",
  shipperId: "h001",
  shipperCode: "3001-H001",
  shipperName: "HONG LEE",
  date: "2026-07-08",
  location: "RANONG",
  areaNote: "",
};

const agentPrefill: CrateExportPrefillTarget = {
  mode: "agent",
  shipperId: "agent-1",
  shipperCode: "AGENT-VEERAKORN",
  shipperName: "VEERAKORN",
  date: "2026-07-08",
  location: "",
  areaNote: "CH FISHERY",
  agentId: "agent-1",
  owedByCode: { ABB: 15 },
  members: [
    {
      memberId: "agent-1",
      memberCode: "AGENT-VEERAKORN",
      memberName: "VEERAKORN",
      label: "CH FISHERY",
      due: { ABB: 15 },
    },
  ],
};

describe("standalonePrefillOriginLocation", () => {
  it("returns origin for standalone multi-origin due-today row", () => {
    expect(standalonePrefillOriginLocation(standaloneMulti)).toBe("RANONG");
  });

  it("ignores agent/pool prefill even when location is set", () => {
    expect(
      standalonePrefillOriginLocation({
        ...agentPrefill,
        location: "RANONG",
      })
    ).toBeNull();
  });

  it("ignores standalone prefill without location", () => {
    expect(
      standalonePrefillOriginLocation({ ...standaloneMulti, location: "" })
    ).toBeNull();
  });
});

describe("resolveStandalonePrefillOriginAfterConfig", () => {
  it("applies pending origin once config lists it", () => {
    expect(
      resolveStandalonePrefillOriginAfterConfig({
        pendingOrigin: "RANONG",
        isMultiOriginCustomer: true,
        locations: ["RANONG", "KHANOM"],
      })
    ).toBe("RANONG");
  });

  it("waits until multi-origin config is loaded", () => {
    expect(
      resolveStandalonePrefillOriginAfterConfig({
        pendingOrigin: "RANONG",
        isMultiOriginCustomer: false,
        locations: [],
      })
    ).toBeNull();
  });

  it("rejects origin not in customer list", () => {
    expect(
      resolveStandalonePrefillOriginAfterConfig({
        pendingOrigin: "UNKNOWN",
        isMultiOriginCustomer: true,
        locations: ["RANONG"],
      })
    ).toBeNull();
  });
});
