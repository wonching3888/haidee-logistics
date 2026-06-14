export const GLOBAL_COST_SETTING_KEYS = [
  "border_pass",
  "epermit",
  "dagang_net",
  "forwarding_outbound",
  "forwarding_return",
  "fuel_price_myr",
] as const;

export type GlobalCostSettingKey = (typeof GLOBAL_COST_SETTING_KEYS)[number];

export interface GlobalCostSettingSeed {
  key: GlobalCostSettingKey;
  valueMyr: number;
  label: string;
  notes: string | null;
}

export const DEFAULT_GLOBAL_COST_SETTINGS: GlobalCostSettingSeed[] = [
  {
    key: "border_pass",
    valueMyr: 0,
    label: "Border Pass",
    notes: "每趟/车",
  },
  {
    key: "epermit",
    valueMyr: 30,
    label: "EPERMIT Chrg",
    notes: "估算2张×RM15/趟",
  },
  {
    key: "dagang_net",
    valueMyr: 10.8,
    label: "Dagang Net Fee",
    notes: "估算2张×RM5.40/趟",
  },
  {
    key: "forwarding_outbound",
    valueMyr: 80,
    label: "Forwarding 出货 Outbound",
    notes: "Zaewe，出货趟",
  },
  {
    key: "forwarding_return",
    valueMyr: 60,
    label: "Forwarding 回空桶 Return",
    notes: "Zaewe，回空桶趟",
  },
  {
    key: "fuel_price_myr",
    valueMyr: 2.05,
    label: "Diesel Price (MYR/L)",
    notes: "统一油价，每月更新",
  },
];

export const GLOBAL_COST_UI_LABELS: Record<
  GlobalCostSettingKey,
  { label: string; notes: string }
> = {
  border_pass: { label: "Border Pass", notes: "每趟/车" },
  epermit: { label: "EPERMIT Chrg", notes: "估算2张/趟" },
  dagang_net: { label: "Dagang Net Fee", notes: "估算2张/趟" },
  forwarding_outbound: { label: "Forwarding 出货", notes: "Zaewe，出货趟" },
  forwarding_return: { label: "Forwarding 回空桶", notes: "Zaewe，回空桶趟" },
  fuel_price_myr: { label: "Diesel Price", notes: "MYR/L，每月更新" },
};
