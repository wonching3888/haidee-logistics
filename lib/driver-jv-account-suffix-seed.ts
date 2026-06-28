/**
 * Initial driver JV account suffix mapping (Step 1 — store only, no export).
 * Match by full name first; optional nickname fallback for known data quirks.
 */
export interface DriverJvAccountSuffixSeed {
  /** Canonical payroll / legal name for documentation */
  canonicalFullName: string;
  accountCodeSuffix: string;
  /** Exact full_name values in drivers table */
  fullNameMatches: string[];
  /** Optional nickname (drivers.name) fallback */
  nicknameMatches?: string[];
}

export const DRIVER_JV_ACCOUNT_SUFFIX_SEEDS: DriverJvAccountSuffixSeed[] = [
  {
    canonicalFullName: "Abdul Halim Bin Ahmad",
    accountCodeSuffix: "HLIM",
    fullNameMatches: ["Abdul Halim Bin Ahmad"],
    nicknameMatches: ["Halim"],
  },
  {
    canonicalFullName: "Sharif Bin Mat",
    accountCodeSuffix: "WANG",
    fullNameMatches: ["Sharif Bin Mat"],
    nicknameMatches: ["Awang"],
  },
  {
    canonicalFullName: "Mohd Azrin Bin Mohd Sadri",
    accountCodeSuffix: "PEIN",
    fullNameMatches: ["Mohd Azrin Bin Mohd Sadri"],
    nicknameMatches: ["Azrin"],
  },
  {
    canonicalFullName: "Wan SyafirulHafiq Bin Wan Mustafa",
    accountCodeSuffix: "WAN1",
    fullNameMatches: ["Wan SyafirulHafiq Bin Wan Mustafa", "Mustafa"],
    nicknameMatches: ["Wan"],
  },
  {
    canonicalFullName: "Muhammad Asrul Bin Abdul Jalil",
    accountCodeSuffix: "OWN1",
    fullNameMatches: ["Muhammad Asrul Bin Abdul Jalil"],
    nicknameMatches: ["Own"],
  },
  {
    canonicalFullName: "Rozaime Bin Othman",
    accountCodeSuffix: "ROZA",
    fullNameMatches: ["Rozaime Bin Othman"],
    nicknameMatches: ["Rozaime"],
  },
  {
    canonicalFullName: "Yong Ah Fook",
    accountCodeSuffix: "FOOK",
    fullNameMatches: ["Yong Ah Fook"],
    nicknameMatches: ["Fook"],
  },
  {
    canonicalFullName: "Ku Mohd Faizal Bin Ku Aziz",
    accountCodeSuffix: "FAIZ",
    fullNameMatches: ["Ku Mohd Faizal Bin Ku Aziz"],
    nicknameMatches: ["Faizal"],
  },
  {
    canonicalFullName: "Muhammad Hakim Bin Mat Sarip",
    accountCodeSuffix: "AKIM",
    fullNameMatches: ["Muhammad Hakim Bin Mat Sarip"],
    nicknameMatches: ["Akim"],
  },
  {
    canonicalFullName: "Mohamad Naim Bin Zulkefli",
    accountCodeSuffix: "NAIM",
    fullNameMatches: ["Mohamad Naim Bin Zulkefli"],
    nicknameMatches: ["Naim"],
  },
  {
    canonicalFullName: "Norazhar Bin Baharom",
    accountCodeSuffix: "AZAR",
    fullNameMatches: ["Norazhar Bin Baharom"],
    nicknameMatches: ["Azhar"],
  },
  {
    canonicalFullName: "Mohd Shafinar Bin Abdullah",
    accountCodeSuffix: "PNAT",
    fullNameMatches: ["Mohd Shafinar Bin Abdullah"],
    nicknameMatches: ["Pinat"],
  },
  {
    canonicalFullName: "Khairuddin Bin Hashim",
    accountCodeSuffix: "DIN1",
    fullNameMatches: ["Khairuddin Bin Hashim"],
    nicknameMatches: ["Din"],
  },
  {
    canonicalFullName: "Mohd Ikmal Hisham Bin Hanapi",
    accountCodeSuffix: "IMAL",
    fullNameMatches: ["Mohd Ikmal Hisham Bin Hanapi"],
    nicknameMatches: ["Ikmal"],
  },
];

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveDriverJvAccountSuffix(driver: {
  name: string;
  fullName: string | null;
}): string | null {
  const full = driver.fullName ? normalizeName(driver.fullName) : "";
  const nick = normalizeName(driver.name);

  for (const seed of DRIVER_JV_ACCOUNT_SUFFIX_SEEDS) {
    if (seed.fullNameMatches.some((name) => normalizeName(name) === full)) {
      return seed.accountCodeSuffix;
    }
    if (
      seed.nicknameMatches?.some((name) => normalizeName(name) === nick) &&
      (!full || seed.fullNameMatches.some((name) => normalizeName(name) === full))
    ) {
      return seed.accountCodeSuffix;
    }
  }

  for (const seed of DRIVER_JV_ACCOUNT_SUFFIX_SEEDS) {
    if (seed.nicknameMatches?.some((name) => normalizeName(name) === nick)) {
      return seed.accountCodeSuffix;
    }
  }

  return null;
}

export function matchDriverJvSuffixSeeds(
  drivers: Array<{ id: string; name: string; fullName: string | null }>
) {
  const matched: Array<{
    driverId: string;
    name: string;
    fullName: string | null;
    accountCodeSuffix: string;
    canonicalFullName: string;
  }> = [];
  const unmatchedDrivers: Array<{
    id: string;
    name: string;
    fullName: string | null;
  }> = [];
  const usedDriverIds = new Set<string>();

  for (const seed of DRIVER_JV_ACCOUNT_SUFFIX_SEEDS) {
    const driver = drivers.find((row) => {
      if (usedDriverIds.has(row.id)) return false;
      return resolveDriverJvAccountSuffix(row) === seed.accountCodeSuffix;
    });

    if (!driver) continue;

    usedDriverIds.add(driver.id);
    matched.push({
      driverId: driver.id,
      name: driver.name,
      fullName: driver.fullName,
      accountCodeSuffix: seed.accountCodeSuffix,
      canonicalFullName: seed.canonicalFullName,
    });
  }

  for (const driver of drivers) {
    if (!usedDriverIds.has(driver.id)) {
      unmatchedDrivers.push(driver);
    }
  }

  return { matched, unmatchedDrivers };
}
