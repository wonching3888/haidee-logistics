# 海利物流管理系统 — CURSOR PRO 完整开发指令 v2.0
# HAI DEE LOGISTICS MANAGEMENT SYSTEM — COMPLETE DEVELOPMENT PROMPT

---

## 1. 项目背景 PROJECT OVERVIEW

为 **海利物流有限公司 (HAI DEE LOGISTICS CO., LTD)** 及其马来西亚关联公司 **WTL Express Sdn Bhd** 建立一套物流管理系统。

业务：从泰国 Sadao 仓库将冰鲜海鲜（保温桶装）运送至马来西亚各大批发市场。

**版权所有：DMC SYSTEM © 2026. All Rights Reserved.**

---

## 2. 技术栈 TECH STACK

```
Frontend:   Next.js 14 (App Router) + TypeScript
UI:         Tailwind CSS + shadcn/ui
Database:   Supabase (PostgreSQL)
ORM:        Prisma
Auth:       Supabase Auth
PDF:        react-to-print
Deployment: Vercel (frontend) + Supabase (database)
Language:   中英双语 (Chinese primary, English secondary)
```

---

## 3. 用户角色 USER ROLES

```
Phase 1 只有两个角色：

1. ADMIN（管理员）
   → 全权限，所有功能

2. 书记 CLERK（仓库员工）
   → 进货录入
   → 空桶回收录入
   → 空桶归还录入
   → 修改录入资料
   → 生成及打印文件
   → 不能访问系统设置

预留（Phase 2）：
3. 老板页面（只看报表，不能修改）
4. 寄货人Portal（查货物状态）
```

---

## 4. 数据库结构 DATABASE SCHEMA

### 4.1 基础资料表

```sql
-- 市场 Markets (13个)
CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR UNIQUE NOT NULL,  -- KL, BM, A, KD, P, MC, BP, TP, SL, KT, NT, SA, JB
  name VARCHAR NOT NULL,         -- SELAYANG, BUKIT MERTAJAM 等
  state VARCHAR,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- 收桶代理 Crate Agents
CREATE TABLE crate_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  whatsapp VARCHAR,
  markets TEXT[],  -- 负责的市场代码数组，如 ['BM','P','KT','NT']
  active BOOLEAN DEFAULT true
);

-- 桶型 Tong Types (11种)
CREATE TABLE tong_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR UNIQUE NOT NULL,  -- ABB, WTL, VIO, MAR, SHK, GSK, BRO, GLY, BS, HD_BHR, BH_BHR
  name VARCHAR NOT NULL,         -- ABIBA, WTL, VIOLET 等
  track_inventory BOOLEAN DEFAULT true,  -- BHR租桶=false (LYS_BHR, LL_BHR)
  is_box BOOLEAN DEFAULT false,   -- BOX盒装
  display_order INT,
  active BOOLEAN DEFAULT true
);

-- 寄货人 Shippers (泰国)
CREATE TABLE shippers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR UNIQUE NOT NULL,   -- S001, S002...
  name VARCHAR NOT NULL,          -- 英文/中文名
  name_th VARCHAR,                -- 泰文名（Phase 3加入）
  phone VARCHAR,
  line_id VARCHAR,
  location VARCHAR,               -- 泰国港口/城市
  default_tong_type_id UUID REFERENCES tong_types(id),  -- 默认桶型
  payment_party VARCHAR DEFAULT 'shipper',  -- 'shipper' or 'receiver'
  company VARCHAR DEFAULT 'haidee',         -- 'haidee' or 'wtl'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- 档口 Stalls (收货人)
CREATE TABLE stalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL,          -- H41, F38, BM10 等
  name VARCHAR,                   -- 收货商号名称（如 鸿发、KIN SOON）
  market_id UUID REFERENCES markets(id),
  active BOOLEAN DEFAULT true
);

-- 寄货人-档口-默认桶型 固定对应表
CREATE TABLE shipper_stall_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id UUID REFERENCES shippers(id),
  stall_id UUID REFERENCES stalls(id),
  tong_type_id UUID REFERENCES tong_types(id),  -- 默认桶型
  UNIQUE(shipper_id, stall_id)
);

-- 运费价目表 Freight Rates
CREATE TABLE freight_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id UUID REFERENCES shippers(id),
  market_id UUID REFERENCES markets(id),
  rate_tong DECIMAL(10,2),   -- 运费/桶（保温桶）
  rate_box DECIMAL(10,2),    -- 运费/盒
  currency VARCHAR DEFAULT 'MYR',  -- 'THB' 寄货人付 / 'MYR' 收货人付
  effective_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(shipper_id, market_id)
);

-- 马来西亚卡车 MY Trucks
CREATE TABLE trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate VARCHAR UNIQUE NOT NULL,   -- KFU 3888
  type VARCHAR DEFAULT 'big',      -- 'big' or 'small'
  capacity_tong INT,               -- 最大载桶量
  active BOOLEAN DEFAULT true
);

-- 泰国车辆 TH Vehicles (选填)
CREATE TABLE th_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate VARCHAR UNIQUE NOT NULL,   -- 70-1743
  shipper_id UUID REFERENCES shippers(id),  -- 属于哪个寄货人（null=海利自有）
  active BOOLEAN DEFAULT true
);
```

### 4.2 业务数据表

```sql
-- 每日进货单 Daily Inbound (一批录入=一个session)
CREATE TABLE inbound_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_no VARCHAR UNIQUE,       -- IN-20260605-001
  date DATE NOT NULL,
  shipper_id UUID REFERENCES shippers(id),
  th_vehicle_plate VARCHAR,        -- 泰国车牌（选填）
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);

-- 进货明细行 Inbound Lines
CREATE TABLE inbound_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES inbound_sessions(id),
  stall_id UUID REFERENCES stalls(id),
  tong_type_id UUID REFERENCES tong_types(id),
  quantity INT NOT NULL,
  is_box BOOLEAN DEFAULT false,
  dispatch_status VARCHAR DEFAULT 'unassigned',  -- 'unassigned' / 'assigned'
  truck_id UUID REFERENCES trucks(id),           -- 分配后填入
  -- 修改记录
  original_quantity INT,           -- 修改前数量
  original_tong_type_id UUID,      -- 修改前桶型
  original_stall_id UUID,          -- 修改前档口
  modified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- 派车单 Dispatch Orders
CREATE TABLE dispatch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no VARCHAR UNIQUE,      -- DO-20260605-001
  date DATE NOT NULL,
  truck_id UUID REFERENCES trucks(id),
  driver_name VARCHAR,
  markets TEXT[],                  -- 本次去的市场 ['KL'] or ['KL','MC']
  status VARCHAR DEFAULT 'draft',  -- 'draft','dispatched','delivered'
  -- 修改记录
  original_truck_id UUID,
  original_driver_name VARCHAR,
  modified_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);

-- 派车明细 Dispatch Lines (inbound_lines分配到dispatch_order)
CREATE TABLE dispatch_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id UUID REFERENCES dispatch_orders(id),
  inbound_line_id UUID REFERENCES inbound_lines(id),
  created_at TIMESTAMP DEFAULT now()
);

-- 空桶回收 Empty Tong Import (马来西亚车回程带回)
CREATE TABLE tong_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  truck_id UUID REFERENCES trucks(id),
  market_id UUID REFERENCES markets(id),
  tong_type_id UUID REFERENCES tong_types(id),
  quantity INT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);

-- 空桶归还 Empty Tong Export (给泰国车带回寄货人)
CREATE TABLE tong_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_no VARCHAR UNIQUE,        -- TE-20260605-001 (收据编号)
  date DATE NOT NULL,
  th_vehicle_plate VARCHAR NOT NULL,
  shipper_id UUID REFERENCES shippers(id),
  tong_type_id UUID REFERENCES tong_types(id),
  quantity_suggested INT,          -- 系统建议数量
  quantity_actual INT NOT NULL,    -- 实际给出数量
  shortage INT DEFAULT 0,          -- 欠桶数
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 5. 市场完整列表 MARKETS SEED DATA

```typescript
const MARKETS = [
  { code: 'KL',  name: 'Pasar Borong Selayang',      state: 'Selangor' },
  { code: 'BM',  name: 'Pasar Borong Bukit Mertajam', state: 'Penang' },
  { code: 'A',   name: 'Pasar Borong Ipoh',           state: 'Perak' },
  { code: 'KD',  name: 'Pasar Borong Alor Setar',     state: 'Kedah' },
  { code: 'P',   name: 'Pasar Borong Penang',         state: 'Penang' },
  { code: 'MC',  name: 'Pasar Borong Melaka',         state: 'Melaka' },
  { code: 'BP',  name: 'Pasar Borong Batu Pahat',     state: 'Johor' },
  { code: 'TP',  name: 'Pasar Borong Taiping',        state: 'Perak' },
  { code: 'SL',  name: 'SL',                          state: '' },
  { code: 'KT',  name: 'Tanjung Piandang',            state: 'Perak' },
  { code: 'NT',  name: "N'Tebal",                     state: 'Penang' },
  { code: 'SA',  name: 'Simpang Ampat',               state: 'Penang' },
  { code: 'JB',  name: 'Johor Bahru',                 state: 'Johor' },
];
```

## 6. 桶型完整列表 TONG TYPES SEED DATA

```typescript
const TONG_TYPES = [
  { code: 'ABB',    name: 'ABIBA',  track: true,  is_box: false, order: 1 },
  { code: 'WTL',    name: 'WTL',    track: true,  is_box: false, order: 2 },
  { code: 'VIO',    name: 'VIOLET', track: true,  is_box: false, order: 3 },
  { code: 'MAR',    name: 'MAROON', track: true,  is_box: false, order: 4 },
  { code: 'SHK',    name: 'SHK',    track: true,  is_box: false, order: 5 },
  { code: 'GSK',    name: 'GSK',    track: true,  is_box: false, order: 6 },
  { code: 'BRO',    name: 'BRO',    track: true,  is_box: false, order: 7 },
  { code: 'GLY',    name: 'GLORY',  track: true,  is_box: false, order: 8 },
  { code: 'BS',     name: 'BS',     track: true,  is_box: false, order: 9 },
  { code: 'HD_BHR', name: 'HD(BHR)',track: true,  is_box: false, order: 10 }, // 海利租BHR
  { code: 'BH_BHR', name: 'BH(BHR)',track: true,  is_box: false, order: 11 }, // 海利租BHR
  { code: 'LYS_BHR',name: 'LYS(BHR)',track: false,is_box: false, order: 12 }, // 寄货人自租
  { code: 'LL_BHR', name: 'LL(BHR)', track: false,is_box: false, order: 13 }, // 寄货人自租
  { code: 'BOX',    name: '盒装BOX', track: false,is_box: true,  order: 14 },
];
```

---

## 7. 页面结构 PAGES & FEATURES

### 7.1 登录页 `/login`
```
公司Logo：海利物流有限公司 / HAI DEE LOGISTICS CO.,LTD
副标题：Powered by DMC SYSTEM
Email + Password 登录
角色自动判断跳转
```

### 7.2 仪表板 `/dashboard` (Admin)
```
今日统计卡片：
- 今日进货总桶数
- 未分配桶数
- 已出发车辆数
- SADAO各桶型库存

各市场今日桶数总览（按市场色标显示）

最新派车单状态

快速操作按钮：
→ 新增进货录入
→ 派车调度
→ 空桶回收录入
```

### 7.3 进货录入 `/inbound`

#### 进货列表页
```
筛选：日期、寄货人、状态（未分配/已分配）
搜索：寄货人名称
表格：日期 | 批次号 | 寄货人 | 泰国车牌 | 总桶数 | 未分配 | 操作
按钮：+ 新增进货
```

#### 新增/编辑进货 `/inbound/new`
```
顶部：
  日期：[今日默认，可修改]
  寄货人：[下拉选择]  ← 选完后自动带出档口列表
  泰国车牌：[文字输入，选填]  ← 可手动输入或选已有

档口录入表格（按寄货人固定档口列表）：
┌──────────┬──────┬──────────────┬──────┐
│ 档口     │ 地区 │ 桶型          │ 桶数 │
├──────────┼──────┼──────────────┼──────┤
│ H41      │ KL   │ [ABB ▼]      │ [  ] │
│ F38      │ KL   │ [ABB ▼]      │ [  ] │
│ K38      │ KD   │ [ABB ▼]      │ [  ] │
│ TP4      │ TP   │ [ABB ▼]      │ [  ] │
└──────────┴──────┴──────────────┴──────┘
→ 桶型可临时修改（偶尔换桶）
→ 空白=不送，不需要填0
→ Tab键快速跳转下一格
→ 数字键盘自动弹出（iPad）

底部：
  各市场小计预览
  [取消] [保存草稿] [确认保存]

同一寄货人当天可多次新增（分批到货）
系统自动汇总当天总数
```

### 7.4 派车调度 `/dispatch`

#### 派车总览矩阵
```
今日进货总览（所有未分配货物）：

寄货人      | KL  | BM  | A   | KD  | P   | MC  | BP  | TP  | ...| 合计
────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼────┼─────
THAI TONG   │  34 │     │     │     │     │  2  │     │  3  │ 39 │  78
HONG LEE    │   7 │  3  │  3  │     │     │     │     │ 10  │    │  23
CP BROTHER  │ 128 │  4  │     │  12 │     │     │     │     │    │ 144
────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼────┼─────
各市场总计  │ 224 │  31 │  17 │  25 │     │  5  │     │  18 │ 39 │

颜色：
KL=红 BM=橙 A=绿 KD=蓝 P=青 MC=紫 BP=黄 ...
```

#### 新建派车单
```
1. 点击"+ 新建派车"
2. 选择：
   车牌：[KFU 3888 ▼]（大车344桶）
   司机：[文字输入]
   目的市场：[KL ▼] + 可选第二市场 [MC ▼]

3. 勾选要装上这辆车的货：
   ✅ THAI TONG → KL 34桶
   ✅ HONG LEE  → KL  7桶
   ✅ CP BROTHER→ KL 128桶
   ...

4. 底部显示：
   已选：224桶 / 车辆容量：344桶
   进度条显示装载率

5. 确认派车 → 生成派车单
   → 相关inbound_lines状态改为'assigned'
```

#### 派车单修改
```
可修改：
→ 车辆/司机
→ 调整货物分配（增加/删除行）
系统保留修改前后数值
```

### 7.5 文件生成 `/documents`

#### 文件1：内部D/O
```
触发：选择派车单 → 生成内部D/O

格式：
────────────────────────────────────────
海利物流有限公司 HAI DEE LOGISTICS CO.,LTD
LORRY NO: KFU 3888    *** DELIVERY ORDER ***    NO: D0024460
DRIVER: Ahmad                                   DATE: 05/06/2026
────────────────────────────────────────
No | Consignor | Store | Area | BOX | HD(BHR) | BH(BHR) | LYS(BHR) | LL(BHR) | ABB | WTL | VIO | MAR | SHK | GSK | BRO | GLY | BS | Other | Qty
1  | CHAH      | B15   | BP   |     |         |         |          |         |  5  |     |     |     |     |     |     |     |    |       |  5
2  | HONG LEE  | A15   | BP   |     |         |         |          |         |     |  1  |     |     |     |     |     |     |    |       |  1
...
────────────────────────────────────────
Total: 1B  13  69  [各桶型合计]  341C + 1B
AGENT/RECEIVER _______________  HAI DEE LOGISTICS CO.,LTD _______________
页: 1/3
```

#### 文件2：外部D/O（给司机）
```
同内部D/O格式，但去掉 Consignor 列
```

#### 文件3：市场D/O（每日渔桶寄至XX）
```
每个市场单独一份PDF

格式：
────────────────────────────────
海利物流有限公司
HAI DEE LOGISTICS CO., LTD,
*** 每日渔桶寄至 KUALA LUMPUR ***
Despatch List by Area Details
日期：5/6/2026
────────────────────────────────
罗哩车牌 | 收货商号 | 摊位 | 地区 | BOX | HD(BHR) | ... | ABB | WTL | ... | 数量
KFU 3888 | [档口名] | A44  | KL   |     |         |     |  14 |     |     |  14
...
────────────────────────────────
总计     盒         [各桶型合计]    XXX桶盒
完毕
```

注意：收货商号显示档口名称，不显示寄货人

#### 文件4：桶型记录（每市场×每桶型）
```
每份 = 一个市场 × 一种桶型

格式：
────────────────────────────────
海利物流有限公司
HAI DEE LOGISTICS CO., LTD,
*** 每日渔桶寄至 ***
Crate by Area/Owner (ABB)
日期：29/5/2026
────────────────────────────────
罗哩车牌 | 收货商号 | 摊位 | 地区 | ABB | 数量
KFU 3888 | T C CHA  | A44  | KL   |  14 | 14桶
...
────────────────────────────────
总计  783  783桶

发送对象（按代理分组）：
KL          → KL代理
MC          → MC代理
BP          → BP+MUAR代理
KD          → KD代理
BM+P+KT+NT  → G Master代理
```

#### 文件5：空桶收据（泰文）
```
格式：
────────────────────────────────────
เลขที่ XXX    บริษัท ไฮดี โลจิสติกส์ จำกัด    No: [自动编号]
              海利物流有限公司
              HAI DEE LOGISTICS CO.,LTD
              [公司地址]
              โทร. 092-2701477, 098-3379070
────────────────────────────────────
นาม: [寄货人名称]  ([泰国车牌])
วันที่: XX เดือน XX พ.ศ. XX

จำนวน | รายละเอียด              | จำนวนเงิน
  72  | XX/XX/XX ส่ง Violet 72 桶 |
────────────────────────────────────
รวมเงิน: -
```

#### 文件生成页面设计
```
选择日期 → 自动列出当天所有派车单

文件类型按钮：
[生成内部D/O]  [生成外部D/O]  [生成市场D/O]  [生成桶型记录]

市场D/O → 显示各市场按钮，点击生成对应PDF
桶型记录 → 显示市场×桶型组合，勾选后批量生成

所有PDF：
→ 在浏览器预览
→ 下载按钮
→ 打印按钮
```

### 7.6 空桶回收 `/tong/import`
```
每天马来西亚车回程录入

日期：[今日]
录入表格：

序号 | 车牌       | 来源市场 | WTL | ABB | BHR | VIO | OTH | 总计 | 备注
  1  | KFU 3888   | X        |     |     |     |     |     |  0   |      ← X=没有回桶
  2  | VNN 3888   | KL       |     | 300 |     |     |     | 300  |
  3  | KGC 3888   | KL       | 164 | 136 |     |     |     | 300  |
  ...

[+ 加一行]

底部各桶型总计：
WTL: 250  ABB: 1388  BHR: 148  VIO: 0  OTH: 75  总计: 1861

[确认保存] → 自动更新SADAO库存
```

### 7.7 空桶归还 `/tong/export`
```
泰国车来SADAO送货，带空桶回去

选择日期
选择寄货人 → 系统显示今天该寄货人送来了多少桶

泰国车牌：[输入或选择]

归还明细：

桶型 | 系统建议 | SADAO现货 | 实际给出 | 欠桶
ABB  |    100   |    380    |  [100]  |   0
WTL  |      0   |     50    |    [0]  |   0

（建议数量 = 今天该寄货人来货数量）
（可手动修改实际给出数量）
（如果SADAO库存不足，欠桶自动计算）

[确认] → 自动生成收据 → 自动更新库存
         → PDF预览 → 可打印/下载
```

### 7.8 桶库存 `/tong/stock`
```
SADAO实时库存总览：

桶型    | SADAO库存 | 今日IN | 今日OUT | 欠桶记录
────────┼──────────┼────────┼─────────┼─────────
ABB     |   1,388  |    +0  |     -0  |    20桶
WTL     |     250  |    +0  |     -0  |     0
VIO     |      48  |    +0  |     -0  |     0
...

欠桶记录明细：
寄货人    | 桶型 | 欠桶数 | 欠桶日期
BROTHER   | ABB  |   20   | 2026-06-05

每日流水记录（可按日期筛选）：
日期       | 类型  | 车牌      | 市场/寄货人 | 桶型 | 数量 | 余额
2026-06-05 | IN   | PQK 6398 | BM         | ABB  | +281 | 1388
2026-06-05 | OUT  | 70-1743  | BROTHER    | ABB  | -100 | 1288
```

### 7.9 修改记录 `/history`
```
可搜索和筛选所有修改过的记录

显示：
原始值 → 新值（字段名）
修改时间

可修改项目：
- 进货录入（桶数/桶型/档口/寄货人）
- 派车单（车辆/司机/货物分配）
```

### 7.10 系统设置 `/settings` (Admin only)
```
Master Data管理：
→ 寄货人管理（增删改）
→ 档口管理（增删改）
→ 寄货人-档口-默认桶型对应表
→ 运费价目表
→ 车辆管理
→ 市场管理
→ 收桶代理管理
→ 用户管理（增删改角色）
```

---

## 8. UI 设计规范 UI DESIGN

### 颜色系统
```css
--navy:        #0A1628;  /* 顶部导航 */
--navy2:       #0F2044;  /* 次级导航 */
--accent:      #00BCD4;  /* 强调色 */
--blue:        #1565C0;  /* 操作按钮 */
--surface:     #F5F7FA;  /* 页面背景 */
--white:       #FFFFFF;  /* 卡片背景 */
--border:      #D0D7E3;  /* 边框 */
--text:        #1A2540;  /* 主文字 */
--text-muted:  #5A6680;  /* 次要文字 */
--green:       #2E7D32;  /* 成功/已分配 */
--orange:      #FF9800;  /* 警告/待处理 */
--red:         #E63946;  /* 错误/删除 */
```

### 市场颜色（全系统统一）
```css
KL  = #E63946  /* 红 */
BM  = #FF9800  /* 橙 */
A   = #4CAF50  /* 绿 */
KD  = #2196F3  /* 蓝 */
P   = #00BCD4  /* 青 */
MC  = #9C27B0  /* 紫 */
BP  = #FF5722  /* 深橙 */
TP  = #795548  /* 棕 */
NT  = #607D8B  /* 蓝灰 */
KT  = #009688  /* 青绿 */
SA  = #8BC34A  /* 浅绿 */
SL  = #FFC107  /* 黄 */
JB  = #E91E63  /* 粉红 */
```

### 字体
```css
font-family: 'IBM Plex Sans', sans-serif;     /* UI文字 */
font-mono: 'IBM Plex Mono', monospace;        /* 数字/编号 */
```

### iPad优化
```
- 最小触控目标：44px × 44px
- 数字输入框自动触发数字键盘：inputMode="numeric"
- 横屏优化派车矩阵
- 竖屏时自动简化显示
- 支持Safari浏览器
```

---

## 9. 双语标签规范 BILINGUAL LABELS

```
中文在前，英文在后：
"桶数 Buckets"
"寄货人 Consignor"
"档口 Store"
"地区 Area"
"派车 Dispatch"
"进货录入 Inbound Entry"
"空桶回收 Empty Tong Import"
"空桶归还 Empty Tong Export"
"未分配 Unassigned"
"已分配 Assigned"
```

---

## 10. 核心业务逻辑 BUSINESS LOGIC

### 编号规则
```
进货批次：IN-YYYYMMDD-XXX  (每日重置)
派车单：  DO-YYYYMMDD-XXX  (每日重置)
空桶收据：TE-YYYYMMDD-XXX  (每日重置，从9773延续)
D/O编号：  D + 7位数字       (如 D0024460，连续递增)
```

### 运费计算
```typescript
freight_amount = quantity × freight_rate
// freight_rate 从 freight_rates 表取
// 寄货人付 = THB，收货人付 = MYR
// 修改桶数时自动重算
```

### 桶库存计算
```typescript
// SADAO库存
sadao_stock = SUM(tong_imports.quantity) - SUM(tong_exports.quantity_actual)

// 欠桶
shortage = SUM(tong_exports.shortage)

// 每次 tong_export 保存时：
quantity_actual = user_input
shortage = MAX(0, quantity_suggested - quantity_actual - sadao_available)
```

### 派车矩阵汇总
```typescript
// 汇总某日所有未分配货物
// 按寄货人×市场 展示
// 每格 = SUM(inbound_lines.quantity) WHERE dispatch_status='unassigned'
```

---

## 11. 项目结构 PROJECT STRUCTURE

```
haidee-logistics/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx              # Sidebar + Header
│   │   ├── dashboard/page.tsx
│   │   ├── inbound/
│   │   │   ├── page.tsx            # 进货列表
│   │   │   ├── new/page.tsx        # 新增进货
│   │   │   └── [id]/edit/page.tsx  # 编辑进货
│   │   ├── dispatch/
│   │   │   ├── page.tsx            # 派车矩阵总览
│   │   │   ├── new/page.tsx        # 新建派车单
│   │   │   └── [id]/page.tsx       # 派车单详情
│   │   ├── documents/page.tsx      # 文件生成中心
│   │   ├── tong/
│   │   │   ├── import/page.tsx     # 空桶回收
│   │   │   ├── export/page.tsx     # 空桶归还
│   │   │   └── stock/page.tsx      # 桶库存总览
│   │   ├── history/page.tsx        # 修改记录
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── shippers/page.tsx
│   │       ├── stalls/page.tsx
│   │       ├── trucks/page.tsx
│   │       ├── rates/page.tsx
│   │       └── users/page.tsx
├── components/
│   ├── ui/                         # shadcn/ui组件
│   ├── inbound/
│   │   ├── InboundForm.tsx         # 进货录入主表单
│   │   └── InboundLineRow.tsx      # 单行录入
│   ├── dispatch/
│   │   ├── DispatchMatrix.tsx      # 派车矩阵
│   │   └── DispatchForm.tsx        # 派车单表单
│   ├── documents/
│   │   ├── InternalDO.tsx          # 内部D/O打印
│   │   ├── ExternalDO.tsx          # 外部D/O打印
│   │   ├── MarketDO.tsx            # 市场D/O打印
│   │   ├── CrateByType.tsx         # 桶型记录打印
│   │   └── TongExportReceipt.tsx   # 空桶收据打印
│   ├── tong/
│   │   ├── TongImportForm.tsx
│   │   ├── TongExportForm.tsx
│   │   └── TongStockTable.tsx
│   └── shared/
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       ├── MarketBadge.tsx         # 市场色标徽章
│       └── TongTypeBadge.tsx
├── lib/
│   ├── supabase.ts
│   ├── prisma.ts
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                     # Seed markets + tong_types
├── types/index.ts
└── middleware.ts                   # Auth + role guard
```

---

## 12. 安装步骤 SETUP INSTRUCTIONS

```bash
# 1. 创建项目
npx create-next-app@latest haidee-logistics --typescript --tailwind --app

# 2. 安装依赖
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install prisma @prisma/client
npm install react-to-print
npm install date-fns
npm install @tanstack/react-table
npx shadcn-ui@latest init

# 安装shadcn组件
npx shadcn-ui@latest add button input select table dialog badge card tabs

# 3. 字体（在layout.tsx引入）
# IBM Plex Sans + IBM Plex Mono from Google Fonts

# 4. 设置Supabase
# → 创建项目
# → 复制API keys到.env.local
# → 运行 npx prisma init
# → 粘贴schema
# → 运行 npx prisma db push
# → 运行 npx prisma db seed

# 5. 开发优先级
# Step 1: 数据库Schema + Seed数据
# Step 2: Auth登录页
# Step 3: 进货录入表单（最核心）
# Step 4: 派车矩阵
# Step 5: 4种文件生成
# Step 6: 桶库存（Import/Export/Stock）
# Step 7: Dashboard
# Step 8: 修改记录
# Step 9: 系统设置
```

---

## 13. 环境变量 ENV VARIABLES

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

---

## 14. 重要注意事项 IMPORTANT NOTES

1. **进货录入是最核心的界面** — 仓库员工每天用iPad操作，必须大触控目标、快速Tab跳格、数字键盘自动弹出

2. **同一寄货人同天可多次录入** — 分批到货，系统自动汇总当天总数

3. **固定档口对应** — 选寄货人后自动带出其固定档口列表，不需要每次手动选档口

4. **桶型列在所有D/O中顺序固定** — BOX | HD(BHR) | BH(BHR) | LYS(BHR) | LL(BHR) | ABB | WTL | VIO | MAR | SHK | GSK | BRO | GLY | BS | Other | Qty

5. **修改记录只保留前后数值** — 不记录修改人，不记录原因

6. **双语标签** — 所有UI标签：中文在前，英文在后

7. **iPad横屏** — 派车矩阵和进货表单需要横屏优化

8. **所有文件只生成PDF** — 不做自动发送，由Admin手动发送

9. **两家公司** — HAI DEE（THB）和 WTL（MYR），运费货币跟着付款方走

10. **版权** — 所有页面底部：© 2026 DMC SYSTEM. All Rights Reserved.

---

## 15. 预留接口 FUTURE PHASES

```
Phase 2：GPS追踪
→ Gussmann GPS API对接
→ trucks表已预留字段
→ dispatch_orders.status可扩展

Phase 3：寄货人Portal
→ users表已支持'shipper'角色
→ shippers.name_th泰文字段已预留
→ 手机端响应式已设计

Phase 4：AutoCount导出
→ 运费数据已结构化存储
→ 可随时添加导出功能

Phase 5：AI辅助录入
→ 数据结构清晰，便于AI识别
→ 可添加OCR接口
```
