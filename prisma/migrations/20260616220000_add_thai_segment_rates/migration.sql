CREATE TABLE IF NOT EXISTS global_cost_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(50) NOT NULL UNIQUE,
  value_myr DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  label VARCHAR(100),
  notes VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO global_cost_settings (key, value_myr, label, notes) VALUES
('songkhla_rate_tong', 0.00, '宋卡段车力/桶 (THB)', '泰国段车力费率'),
('songkhla_rate_box', 0.00, '宋卡段车力/盒 (THB)', '泰国段车力费率'),
('pattani_rate_tong', 0.00, '北大年段车力/桶 (THB)', '泰国段车力费率'),
('pattani_rate_box', 0.00, '北大年段车力/盒 (THB)', '泰国段车力费率')
ON CONFLICT (key) DO NOTHING;
