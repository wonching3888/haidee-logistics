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

export type SettingsSidebarLeaf = {
  section: SettingsSection;
  label: string;
  labelEn: string;
};

export type SettingsFreightSubgroup = {
  label: string;
  labelEn: string;
  children: SettingsSidebarLeaf[];
};

export type SettingsSidebarGroupItem = SettingsSidebarLeaf | SettingsFreightSubgroup;

export function isSettingsFreightSubgroup(
  item: SettingsSidebarGroupItem
): item is SettingsFreightSubgroup {
  return "children" in item;
}

export type SettingsSidebarGroup = {
  id: "customer" | "fleet" | "system";
  label: string;
  labelEn: string;
  items: SettingsSidebarGroupItem[];
};

/** Settings submenu: grouped Customer / Fleet / System (order only; hrefs unchanged). */
export const SETTINGS_SIDEBAR_GROUPS: SettingsSidebarGroup[] = [
  {
    id: "customer",
    label: "客户",
    labelEn: "Customer",
    items: [
      { section: "shippers", label: "寄货人", labelEn: "Shippers" },
      { section: "receivers", label: "收货人", labelEn: "Receivers" },
      {
        section: "defaults",
        label: "收货人对应",
        labelEn: "Receiver Defaults",
      },
      {
        label: "车力费率",
        labelEn: "Freight Rates",
        children: [
          {
            section: "shipper-rates",
            label: "寄货人费率",
            labelEn: "Shipper Rates",
          },
          {
            section: "consignee-rates",
            label: "收货人费率",
            labelEn: "Consignee Rates",
          },
          {
            section: "payment-relations",
            label: "付款关系",
            labelEn: "Payment Relations",
          },
        ],
      },
      {
        section: "crate-rental-rates",
        label: "租桶费率",
        labelEn: "Crate Rental Rates",
      },
    ],
  },
  {
    id: "fleet",
    label: "车队",
    labelEn: "Fleet",
    items: [
      { section: "trucks", label: "车辆", labelEn: "Trucks" },
      {
        section: "driver-payroll",
        label: "司机资料",
        labelEn: "Driver Master Data",
      },
      { section: "routes", label: "路线", labelEn: "Routes" },
      {
        section: "payroll-settings",
        label: "薪资设定",
        labelEn: "Payroll Settings",
      },
    ],
  },
  {
    id: "system",
    label: "系统/营运",
    labelEn: "System",
    items: [
      { section: "users", label: "用户", labelEn: "Users" },
      {
        section: "unload-settings",
        label: "下货费设定",
        labelEn: "Unload Settings",
      },
      {
        section: "operations-settings",
        label: "营运设定",
        labelEn: "Operations Settings",
      },
    ],
  },
];
