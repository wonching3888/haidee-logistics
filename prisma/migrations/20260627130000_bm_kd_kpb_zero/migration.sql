-- BM / KD: KPB permanently cancelled (unload rates unchanged).
UPDATE unloading_rate_configs
SET kpb_small = 0, kpb_large = 0, kpb_box = 0
WHERE market IN ('BM', 'KD');
