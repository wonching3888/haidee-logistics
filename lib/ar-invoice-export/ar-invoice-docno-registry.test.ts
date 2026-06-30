import { describe, expect, it } from "vitest";
import {
  arDocNoPrefixForCrateReturnDebtor,
  formatArDocNo,
} from "@/lib/ar-invoice-export/ar-invoice-docno";
import { buildArDocNoRegistryFromSlots } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";

describe("arDocNoPrefixForCrateReturnDebtor", () => {
  it("maps Epic 3002- to HDR- and Tawakar 3000- to EXP-", () => {
    expect(arDocNoPrefixForCrateReturnDebtor("3002-E001")).toBe("HDR-");
    expect(arDocNoPrefixForCrateReturnDebtor("3000-T002")).toBe("EXP-");
    expect(arDocNoPrefixForCrateReturnDebtor("3999-X")).toBeNull();
  });
});

describe("buildArDocNoRegistryFromSlots global ordering", () => {
  it("assigns HDR- sequence: mode2 freight → charter → crate return 3002-", () => {
    const registry = buildArDocNoRegistryFromSlots(2026, 6, [
      { entityKey: "freight:2:c1:2026-06", prefix: "HDR-" },
      { entityKey: "freight:2:c2:2026-06", prefix: "HDR-" },
      { entityKey: "charter:trip-a", prefix: "HDR-" },
      { entityKey: "charter:trip-b", prefix: "HDR-" },
      { entityKey: "crate_return:epic", prefix: "HDR-" },
    ]);

    expect(registry.byEntityKey.get("freight:2:c1:2026-06")).toBe("HDR-2606-001");
    expect(registry.byEntityKey.get("freight:2:c2:2026-06")).toBe("HDR-2606-002");
    expect(registry.byEntityKey.get("charter:trip-a")).toBe("HDR-2606-003");
    expect(registry.byEntityKey.get("charter:trip-b")).toBe("HDR-2606-004");
    expect(registry.byEntityKey.get("crate_return:epic")).toBe("HDR-2606-005");
  });

  it("assigns EXP- sequence: mode3 → mode4 → crate return 3000-", () => {
    const registry = buildArDocNoRegistryFromSlots(2026, 6, [
      { entityKey: "freight:3:a:2026-06", prefix: "EXP-" },
      { entityKey: "freight:3:b:2026-06", prefix: "EXP-" },
      { entityKey: "freight:4:x:2026-06", prefix: "EXP-" },
      { entityKey: "freight:4:y:2026-06", prefix: "EXP-" },
      { entityKey: "crate_return:tawakar", prefix: "EXP-" },
    ]);

    expect(registry.byEntityKey.get("freight:3:a:2026-06")).toBe("EXP-2606-001");
    expect(registry.byEntityKey.get("freight:3:b:2026-06")).toBe("EXP-2606-002");
    expect(registry.byEntityKey.get("freight:4:x:2026-06")).toBe("EXP-2606-003");
    expect(registry.byEntityKey.get("freight:4:y:2026-06")).toBe("EXP-2606-004");
    expect(registry.byEntityKey.get("crate_return:tawakar")).toBe("EXP-2606-005");
  });

  it("keeps fixed DocNo per entity regardless of export block", () => {
    const registry = buildArDocNoRegistryFromSlots(2026, 6, [
      { entityKey: "freight:2:3002-A:2026-06", prefix: "HDR-" },
      { entityKey: "charter:t1", prefix: "HDR-" },
      { entityKey: "crate_return:1", prefix: "HDR-" },
    ]);

    const charterDocNo = registry.byEntityKey.get("charter:t1");
    const crateDocNo = registry.byEntityKey.get("crate_return:1");
    expect(charterDocNo).toBe("HDR-2606-002");
    expect(crateDocNo).toBe("HDR-2606-003");
    expect(formatArDocNo("HDR-", 2026, 6, 2)).toBe(charterDocNo);
    expect(formatArDocNo("HDR-", 2026, 6, 3)).toBe(crateDocNo);
  });

  it("assigns HD- sequence: mode 1a then 1b", () => {
    const registry = buildArDocNoRegistryFromSlots(2026, 6, [
      { entityKey: "freight:1a:a:2026-06", prefix: "HD-" },
      { entityKey: "freight:1b:b:2026-06", prefix: "HD-" },
    ]);

    expect(registry.byEntityKey.get("freight:1b:b:2026-06")).toBe("HD-2606-002");
  });
});
