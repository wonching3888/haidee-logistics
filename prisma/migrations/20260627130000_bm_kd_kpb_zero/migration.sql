-- BM / KD: KPB permanently cancelled (unload rates unchanged).
UPDATE unloading_rate_configs
SET "kpbSmall" = 0, "kpbLarge" = 0, "kpbBox" = 0
WHERE market IN ('BM', 'KD');
