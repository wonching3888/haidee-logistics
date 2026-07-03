import { describe, expect, it } from "vitest";
import { lookupSocsoContributions, SOCSO_BRACKETS } from "@/lib/constants/socso-brackets";

describe("SOCSO First Category official 2026 brackets", () => {
  it("has 64 wage tiers up to RM6000", () => {
    expect(SOCSO_BRACKETS).toHaveLength(64);
    expect(SOCSO_BRACKETS[SOCSO_BRACKETS.length - 1]).toEqual({
      wageTo: 6000,
      employee: 29.75,
      employer: 104.15,
    });
  });

  it("ceiling anchor: gross >= 6000", () => {
    expect(lookupSocsoContributions(6000)).toEqual({
      employee: 29.75,
      employer: 104.15,
    });
    expect(lookupSocsoContributions(9000)).toEqual({
      employee: 29.75,
      employer: 104.15,
    });
  });

  it("floor anchor: wage <= 30", () => {
    expect(lookupSocsoContributions(30)).toEqual({
      employee: 0.1,
      employer: 0.4,
    });
  });

  it("mid bracket gross 4000 (official Majikan/Pekerja Keilatan)", () => {
    expect(lookupSocsoContributions(4000)).toEqual({
      employee: 19.75,
      employer: 69.15,
    });
  });

  it("mid bracket gross 4630 (Akim June tier 4700)", () => {
    expect(lookupSocsoContributions(4630)).toEqual({
      employee: 23.25,
      employer: 81.35,
    });
  });
});
