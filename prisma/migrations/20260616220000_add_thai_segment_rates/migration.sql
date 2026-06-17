INSERT INTO global_cost_settings (id, key, value_myr, label, notes) VALUES
(gen_random_uuid(), 'songkhla_rate_tong', 0.00, '宋卡段车力/桶 (THB)', '泰国段车力费率'),
(gen_random_uuid(), 'songkhla_rate_box', 0.00, '宋卡段车力/盒 (THB)', '泰国段车力费率'),
(gen_random_uuid(), 'pattani_rate_tong', 0.00, '北大年段车力/桶 (THB)', '泰国段车力费率'),
(gen_random_uuid(), 'pattani_rate_box', 0.00, '北大年段车力/盒 (THB)', '泰国段车力费率')
ON CONFLICT (key) DO NOTHING;
