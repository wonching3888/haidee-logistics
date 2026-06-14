export type SettingsSection =
  | "shippers"
  | "receivers"
  | "defaults"
  | "trucks"
  | "users"
  | "routes"
  | "payroll-settings"
  | "crate-rental-rates"
  | "unload-settings"
  | "shipper-rates"
  | "consignee-rates"
  | "payment-relations"
  | "operations-settings"
  | "driver-payroll";

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "shippers";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  "shippers",
  "receivers",
  "defaults",
  "trucks",
  "users",
  "routes",
  "payroll-settings",
  "crate-rental-rates",
  "unload-settings",
  "shipper-rates",
  "consignee-rates",
  "payment-relations",
  "operations-settings",
  "driver-payroll",
];

/** Old section slugs → current (for redirects). */
export const LEGACY_SETTINGS_SECTION_MAP: Record<string, SettingsSection> = {
  stalls: "receivers",
  "allowance-settings": "payroll-settings",
  "exchange-rate": "operations-settings",
};

export const SETTINGS_SECTION_TITLES: Record<
  SettingsSection,
  { label: string; labelEn: string }
> = {
  shippers: { label: "寄货人", labelEn: "Shippers" },
  receivers: { label: "收货人", labelEn: "Receivers" },
  defaults: { label: "收货人对应", labelEn: "Receiver Defaults" },
  trucks: { label: "车辆", labelEn: "Trucks" },
  users: { label: "用户", labelEn: "Users" },
  routes: { label: "路线", labelEn: "Routes" },
  "payroll-settings": { label: "薪资设定", labelEn: "Payroll Settings" },
  "crate-rental-rates": { label: "租桶费率", labelEn: "Crate Rental Rates" },
  "unload-settings": { label: "下货费设定", labelEn: "Unload Settings" },
  "shipper-rates": { label: "寄货人费率", labelEn: "Shipper Rates" },
  "consignee-rates": { label: "收货人费率", labelEn: "Consignee Rates" },
  "payment-relations": { label: "付款关系", labelEn: "Payment Relations" },
  "operations-settings": { label: "营运设定", labelEn: "Operations Settings" },
  "driver-payroll": { label: "司机资料", labelEn: "Driver Master Data" },
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
  if (value && LEGACY_SETTINGS_SECTION_MAP[value]) {
    return LEGACY_SETTINGS_SECTION_MAP[value];
  }
  if (value && SETTINGS_SECTIONS.includes(value as SettingsSection)) {
    return value as SettingsSection;
  }
  return DEFAULT_SETTINGS_SECTION;
}

export function resolveSettingsSectionRedirect(
  value: string | null | undefined
): SettingsSection | null {
  if (value && LEGACY_SETTINGS_SECTION_MAP[value]) {
    return LEGACY_SETTINGS_SECTION_MAP[value];
  }
  return null;
}

export function settingsSectionHref(section: SettingsSection) {
  return `/settings?section=${section}`;
}

/** Main sidebar menu tree for Settings */
export const SETTINGS_SIDEBAR_MENU = [
  { section: "shippers" as const, label: "寄货人", labelEn: "Shippers" },
  { section: "receivers" as const, label: "收货人", labelEn: "Receivers" },
  {
    section: "defaults" as const,
    label: "收货人对应",
    labelEn: "Receiver Defaults",
  },
  { section: "trucks" as const, label: "车辆", labelEn: "Trucks" },
  { section: "users" as const, label: "用户", labelEn: "Users" },
  {
    section: "driver-payroll" as const,
    label: "司机资料",
    labelEn: "Driver Master Data",
  },
  { section: "routes" as const, label: "路线", labelEn: "Routes" },
  {
    section: "payroll-settings" as const,
    label: "薪资设定",
    labelEn: "Payroll Settings",
  },
  {
    section: "crate-rental-rates" as const,
    label: "租桶费率",
    labelEn: "Crate Rental Rates",
  },
  {
    section: "unload-settings" as const,
    label: "下货费设定",
    labelEn: "Unload Settings",
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
    section: "operations-settings" as const,
    label: "营运设定",
    labelEn: "Operations Settings",
  },
];
