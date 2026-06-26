-- BM Pindah per-trip unload + MC third-party flat unload (camelCase columns).
ALTER TABLE "unloading_rate_configs"
  ADD COLUMN "perTripSmallTruck" DOUBLE PRECISION,
  ADD COLUMN "perTripLargeTruck" DOUBLE PRECISION,
  ADD COLUMN "thirdPartyFlatUnload" DOUBLE PRECISION;

UPDATE "unloading_rate_configs"
SET
  "perTripSmallTruck" = 12,
  "perTripLargeTruck" = 20,
  "smallCrate" = 0,
  "largeCrate" = 0,
  "box" = 0
WHERE market IN ('TP', 'KT', 'P', 'SA', 'NT');

UPDATE "unloading_rate_configs"
SET "thirdPartyFlatUnload" = 0.7
WHERE market = 'MC';
