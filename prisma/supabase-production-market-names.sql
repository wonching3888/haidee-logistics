-- ============================================================
-- Haidee Logistics: 更新 KL / SL 市场名称（生产 Supabase 直接执行）
-- 在 Supabase Dashboard → SQL Editor → New query 粘贴后点击 Run
-- ============================================================

-- 1) 更新 markets 主数据
UPDATE markets
SET name = 'SELAYANG'
WHERE code = 'KL'
   OR name ILIKE 'KUALA LUMPUR'
   OR name ILIKE 'K.L.%';

UPDATE markets
SET name = 'SEREMBAN'
WHERE code = 'SL'
   OR name ILIKE 'SELANGOR';

-- 2) 同步历史 area_note 文本（进货/空桶导出等旧记录）
UPDATE inbound_sessions
SET area_note = 'SELAYANG'
WHERE area_note ILIKE 'KUALA LUMPUR';

UPDATE inbound_sessions
SET area_note = 'SEREMBAN'
WHERE area_note ILIKE 'SELANGOR';

UPDATE tong_exports
SET area_note = 'SELAYANG'
WHERE area_note ILIKE 'KUALA LUMPUR';

UPDATE tong_exports
SET area_note = 'SEREMBAN'
WHERE area_note ILIKE 'SELANGOR';

-- 3) 验证结果（应看到 KL=SELAYANG, SL=SEREMBAN）
SELECT code, name FROM markets WHERE code IN ('KL', 'SL') ORDER BY code;

-- 4) 检查是否还有 SELANGOR 残留
SELECT 'inbound_sessions' AS tbl, COUNT(*) AS cnt
FROM inbound_sessions WHERE area_note ILIKE 'SELANGOR'
UNION ALL
SELECT 'tong_exports', COUNT(*)
FROM tong_exports WHERE area_note ILIKE 'SELANGOR';
