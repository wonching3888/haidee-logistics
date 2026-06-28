import { describe, expect, it } from "vitest";
import {
  buildDriverJvAccountCodes,
  SHARED_PAYROLL_JV_ACCOUNTS,
} from "@/lib/constants/payroll-jv-accounts";
import {
  DRIVER_JV_ACCOUNT_SUFFIX_SEEDS,
  matchDriverJvSuffixSeeds,
  resolveDriverJvAccountSuffix,
} from "@/lib/driver-jv-account-suffix-seed";

describe("buildDriverJvAccountCodes", () => {
  it("builds per-driver and shared JV account codes for AKIM", () => {
    expect(
      buildDriverJvAccountCodes({ accountCodeSuffix: "AKIM" })
    ).toEqual({
      baseSalary: "6308-AKIM",
      wages: "6307-AKIM",
      epfEmployer: "9005-AKIM",
      socsoEisEmployer: "9006-AKIM",
      advance: "3301-AKIM",
      netPayable: "4104-AKIM",
      epfPayable: SHARED_PAYROLL_JV_ACCOUNTS.epfPayable,
      socsoEisPayable: SHARED_PAYROLL_JV_ACCOUNTS.socsoEisPayable,
      pcbPayable: SHARED_PAYROLL_JV_ACCOUNTS.pcbPayable,
    });
  });

  it("normalizes suffix casing", () => {
    expect(
      buildDriverJvAccountCodes({ accountCodeSuffix: " akim " }).baseSalary
    ).toBe("6308-AKIM");
  });

  it("rejects empty suffix", () => {
    expect(() => buildDriverJvAccountCodes({ accountCodeSuffix: "  " })).toThrow(
      /suffix/i
    );
  });
});

describe("driver JV suffix seeds", () => {
  it("defines 14 driver suffix mappings", () => {
    expect(DRIVER_JV_ACCOUNT_SUFFIX_SEEDS).toHaveLength(14);
  });

  it("resolves Muhammad Hakim by full name", () => {
    expect(
      resolveDriverJvAccountSuffix({
        name: "Akim",
        fullName: "Muhammad Hakim Bin Mat Sarip",
      })
    ).toBe("AKIM");
  });

  it("matches all 14 canonical drivers when DB names align", () => {
    const drivers = DRIVER_JV_ACCOUNT_SUFFIX_SEEDS.flatMap((seed) => ({
      id: seed.accountCodeSuffix,
      name: seed.nicknameMatches?.[0] ?? seed.canonicalFullName,
      fullName: seed.fullNameMatches[0] ?? null,
    }));

    const { matched, unmatchedDrivers } = matchDriverJvSuffixSeeds(drivers);
    expect(matched).toHaveLength(14);
    expect(unmatchedDrivers).toHaveLength(0);
  });
});
