import { describe, expect, it } from "vitest";
import {
  derivePcbNeedsReview,
  normalizeSpouseWorking,
} from "@/lib/driver-pcb-profile";

describe("normalizeSpouseWorking", () => {
  it("clears spouseWorking when not married", () => {
    expect(
      normalizeSpouseWorking({ maritalStatus: "single", spouseWorking: true })
    ).toBeNull();
    expect(
      normalizeSpouseWorking({ maritalStatus: null, spouseWorking: false })
    ).toBeNull();
  });

  it("keeps boolean when married", () => {
    expect(
      normalizeSpouseWorking({ maritalStatus: "married", spouseWorking: true })
    ).toBe(true);
    expect(
      normalizeSpouseWorking({ maritalStatus: "married", spouseWorking: false })
    ).toBe(false);
    expect(
      normalizeSpouseWorking({ maritalStatus: "married", spouseWorking: null })
    ).toBeNull();
  });
});

describe("derivePcbNeedsReview", () => {
  it("is false for single drivers", () => {
    expect(
      derivePcbNeedsReview({ maritalStatus: "single", spouseWorking: null })
    ).toBe(false);
  });

  it("is false when married and spouseWorking is set", () => {
    expect(
      derivePcbNeedsReview({ maritalStatus: "married", spouseWorking: true })
    ).toBe(false);
    expect(
      derivePcbNeedsReview({ maritalStatus: "married", spouseWorking: false })
    ).toBe(false);
  });

  it("is true when married and spouseWorking is missing", () => {
    expect(
      derivePcbNeedsReview({ maritalStatus: "married", spouseWorking: null })
    ).toBe(true);
  });

  it("is true when marital status is unknown", () => {
    expect(
      derivePcbNeedsReview({ maritalStatus: null, spouseWorking: null })
    ).toBe(true);
  });
});
