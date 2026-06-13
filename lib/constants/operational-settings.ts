export const DEFAULT_OPERATIONAL_SETTINGS = {
  mcThirdPartyRateTong: null as number | null,
  mcThirdPartyRateBox: null as number | null,
  mySegmentRateTong: null as number | null,
  mySegmentRateBox: null as number | null,
  driverAllowancePerCrate: null as number | null,
};

export type OperationalSettingsValues = typeof DEFAULT_OPERATIONAL_SETTINGS;
