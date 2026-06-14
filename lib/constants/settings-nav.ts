export type SettingsSection =
  | "shippers"
  | "stalls"
  | "defaults"
  | "trucks"
  | "users"
  | "routes"
  | "allowance-settings"
  | "shipper-rates"
  | "consignee-rates"
  | "payment-relations"
  | "exchange-rate"
  | "driver-payroll";

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "shippers";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  "shippers",
  "stalls",
  "defaults",
  "trucks",
  "users",
  "routes",
  "allowance-settings",
  "shipper-rates",
  "consignee-rates",
  "payment-relations",
  "exchange-rate",
  "driver-payroll",
];

export const SETTINGS_SECTION_TITLES: Record<
  SettingsSection,
  { label: string; labelEn: string }
> = {
  shippers: { label: "寄货人", labelEn: "Shippers" },
  stalls: { label: "档口", labelEn: "Stalls" },
  defaults: { label: "档口对应", labelEn: "Defaults" },
  trucks: { label: "车辆", labelEn: "Trucks" },
  users: { label: "用户", labelEn: "Users" },
  routes: { label: "路线", labelEn: "Routes" },
  "allowance-settings": { label: "津贴设定", labelEn: "Allowance Settings" },
  "shipper-rates": { label: "寄货人费率", labelEn: "Shipper Rates" },
  "consignee-rates": { label: "收货人费率", labelEn: "Consignee Rates" },
  "payment-relations": { label: "付款关系", labelEn: "Payment Relations" },
  "exchange-rate": { label: "汇率设定", labelEn: "Exchange Rate" },
  "driver-payroll": { label: "司机薪资", labelEn: "Driver Payroll" },
};

export const SETTINGS_FREIGHT_SECTIONS: SettingsSection[] = [
  "shipper-rates",
  "consignee-rates",
  "payment-relations",
];

export function isFreightSettingsSection(section: SettingsSection) {
  return SETTINGS_FREIGHT_SECTIONS.includes(section);
}

export function parseSettingsSection(
  value: string | null | undefined
): SettingsSection {
  if (value && SETTINGS_SECTIONS.includes(value as SettingsSection)) {
    return value as SettingsSection;
  }
  return DEFAULT_SETTINGS_SECTION;
}

export function settingsSectionHref(section: SettingsSection) {
  return `/settings?section=${section}`;
}

/** Main sidebar menu tree for Settings */
export const SETTINGS_SIDEBAR_MENU = [
  { section: "shippers" as const, label: "寄货人", labelEn: "Shippers" },
  { section: "stalls" as const, label: "档口", labelEn: "Stalls" },
  { section: "defaults" as const, label: "档口对应", labelEn: "Defaults" },
  { section: "trucks" as const, label: "车辆", labelEn: "Trucks" },
  { section: "users" as const, label: "用户", labelEn: "Users" },
  { section: "routes" as const, label: "路线", labelEn: "Routes" },
  {
    section: "allowance-settings" as const,
    label: "津贴设定",
    labelEn: "Allowance Settings",
  },
  {
    label: "车力费率",
    labelEn: "Freight Rates",
    children: [
      {
        section: "shipper-rates" as const,
        label: "寄货人费率",
        labelEn: "Shipper Rates",
      },
      {
        section: "consignee-rates" as const,
        label: "收货人费率",
        labelEn: "Consignee Rates",
      },
      {
        section: "payment-relations" as const,
        label: "付款关系",
        labelEn: "Payment Relations",
      },
    ],
  },
  {
    section: "exchange-rate" as const,
    label: "汇率设定",
    labelEn: "Exchange Rate",
  },
  {
    section: "driver-payroll" as const,
    label: "司机薪资",
    labelEn: "Driver Payroll",
  },
];
