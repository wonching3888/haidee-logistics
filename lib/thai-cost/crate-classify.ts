/**
 * Thai-cost-only crate size classification.
 * Must NOT import or share LARGE_CRATE_CODES / classifyCrate from driver-expense
 * (Malaysia unloading fees stay on VIO/BS only).
 */

export const DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES = [
  "VIO",
  "BS",
  "GKS",
] as const;

export type ThaiCostCrateBucket = "small" | "large" | "box";

export function parseLargeTongTypeCodes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    return [...DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const codes = parsed
        .map((c) => String(c).trim().toUpperCase())
        .filter(Boolean);
      return codes.length > 0 ? codes : [...DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES];
    }
  } catch {
    // fall through to CSV
  }
  const codes = raw
    .split(/[,;\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return codes.length > 0 ? codes : [...DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES];
}

export function serializeLargeTongTypeCodes(codes: string[]): string {
  const normalized = [
    ...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean)),
  ];
  return JSON.stringify(
    normalized.length > 0
      ? normalized
      : [...DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES]
  );
}

/** Thai cost bucket: box first, then large codes from settings, else small. */
export function classifyThaiCostCrate(
  tongCode: string,
  isBox: boolean,
  largeTongTypeCodes: readonly string[]
): ThaiCostCrateBucket {
  const code = tongCode.trim().toUpperCase();
  if (isBox || code === "BOX") return "box";
  const largeSet = new Set(
    largeTongTypeCodes.map((c) => c.trim().toUpperCase()).filter(Boolean)
  );
  if (largeSet.has(code)) return "large";
  return "small";
}
