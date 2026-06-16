export const THAI_SEGMENT_RATE_KEYS = [
  "songkhla_rate_tong",
  "songkhla_rate_box",
  "pattani_rate_tong",
  "pattani_rate_box",
] as const;

export type ThaiSegmentRateKey = (typeof THAI_SEGMENT_RATE_KEYS)[number];

export interface ThaiSegmentRates {
  songkhlaRateTong: number;
  songkhlaRateBox: number;
  pattaniRateTong: number;
  pattaniRateBox: number;
}

export const THAI_SEGMENT_RATE_UI: Record<
  ThaiSegmentRateKey,
  { label: string; notes: string }
> = {
  songkhla_rate_tong: {
    label: "宋卡段车力/桶 Songkhla Rate per Tong",
    notes: "THB/桶",
  },
  songkhla_rate_box: {
    label: "宋卡段车力/盒 Songkhla Rate per Box",
    notes: "THB/盒",
  },
  pattani_rate_tong: {
    label: "北大年段车力/桶 Pattani Rate per Tong",
    notes: "THB/桶",
  },
  pattani_rate_box: {
    label: "北大年段车力/盒 Pattani Rate per Box",
    notes: "THB/盒",
  },
};

export function parseThaiSegmentRates(
  settings: { key: string; valueMyr: number }[]
): ThaiSegmentRates {
  const byKey = new Map(settings.map((row) => [row.key, row.valueMyr]));
  return {
    songkhlaRateTong: byKey.get("songkhla_rate_tong") ?? 0,
    songkhlaRateBox: byKey.get("songkhla_rate_box") ?? 0,
    pattaniRateTong: byKey.get("pattani_rate_tong") ?? 0,
    pattaniRateBox: byKey.get("pattani_rate_box") ?? 0,
  };
}
