import { describe, expect, it } from "vitest";
import { charterNoInCharterDeductionNotes } from "./charter-crate-stock";

describe("charterNoInCharterDeductionNotes", () => {
  it("matches applyCharterCrateDeduction note format", () => {
    const eno = "CH-20260706-002";
    const note = `包车扣减 Charter ${eno}`;
    expect(note).toContain(charterNoInCharterDeductionNotes(eno));
  });

  it("builds stable notes search token", () => {
    expect(charterNoInCharterDeductionNotes(" CH-20260706-002 ")).toBe(
      "Charter CH-20260706-002"
    );
  });
});
