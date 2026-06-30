export interface PartialFreightRateInput {
  marketId: string;
  rateTong?: number;
  rateBox?: number;
}

export function parseOptionalRateField(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("费率必须为非负数 Rate must be a non-negative number");
  }
  return num;
}

/** Build create/update payloads: undefined field = skip on update (do not null-out). */
export function buildFreightRateFieldWrites(rate: PartialFreightRateInput): {
  create: { rateTong: number | null; rateBox: number | null };
  update: { rateTong?: number | null; rateBox?: number | null };
} {
  const create = {
    rateTong: rate.rateTong ?? null,
    rateBox: rate.rateBox ?? null,
  };
  const update: { rateTong?: number | null; rateBox?: number | null } = {};
  if (rate.rateTong !== undefined) update.rateTong = rate.rateTong;
  if (rate.rateBox !== undefined) update.rateBox = rate.rateBox;
  return { create, update };
}

export function hasFreightRateFieldWrites(rate: PartialFreightRateInput): boolean {
  return rate.rateTong !== undefined || rate.rateBox !== undefined;
}
