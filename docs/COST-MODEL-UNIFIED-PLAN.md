# 统一成本方案 — 决策定稿

> **文档性质**：实施依据（设计定稿）。  
> **状态**：方案已定稿，**等老板下令才开工**。  
> **开工前提**：司机报销 ①–④ 书记试用稳定。  
> **定稿日期**：2026-06-16  
> **范围**：成本闸门（⑤⑥）+ 按市场实际值 + 车辆成本按市场分摊 — 三块统一，一次上线。

---

## 1. 背景与目标

Haidee 物流成本需精确归集到 **市场 / 货 / 顾客**，支撑 P&L 与顾客分析。此前存在三类问题：

| 板块 | 问题 |
|------|------|
| **A. 成本闸门（⑤⑥）** | 报销单保存即 writeback；未审数据影响成本；`cost_applied_at` 无读取逻辑 |
| **B. 按市场实际值** | `parking/kpb/upah_turun_actual` 为一趟单值；UI 仅最后一格可编辑；保存按比例冲掉 Module1 手填 |
| **C. 车辆成本分摊** | 多市场同车按最远市场里程算整车油费/过路，再按桶数平摊 → BM 货背负 MC 远途成本，顾客分析失真 |

**目标**：三块统一进 `trip-cost-engine`，P&L 与 operations 共用同一口径；一次上线，全量生效（2026-06 起仅一个月数据，历史全部重算）。

---

## 2. 成本归属规则（定稿）

以 **BM 50 桶 + MC 100 桶**（全车 150 桶）为例。假设路线主数据：`SADAO→BM = 350 km`，`SADAO→MC = 1300 km`，则 `BM→MC` 独享段 = `1300 − 350 = 950 km`。

### 2.1 四类费用归属

| 类别 | 包含项 | 归属规则 | BM50+MC100 示例 |
|------|--------|----------|-----------------|
| **① 全局费用** | 过关、边境、epermit、Dagang Net、Forwarding 等一趟一次性费用 | **全车按桶数摊**：`份额 = 该货桶数 / 全车桶数` | 各全局费 × 50/150（BM）、× 100/150（MC） |
| **② 下货费（含停车）** | Upah Turun、KPB、**停车费实际值** | **按市场各自算**：BM 市场只算 BM 桶；MC 市场只算 MC 桶；不按全车桶数互摊 | BM 下货/停车/KPB 只挂 BM 50 桶；MC 只挂 MC 100 桶 |
| **③ 路线可变费用（按公里）** | 车辆油费、维修（按公里） | **分段里程法（leg-based）**：见 §2.2 | SADAO→BM 段 350 km 全车摊；BM→MC 段 950 km **仅 MC 货摊** |
| **④ 过路费** | Toll | **同分段里程**：各段过路费按该段规则摊；段内按桶数；差异小不细究 | 与 ③ 同段、同分母逻辑 |

### 2.2 分段里程法（leg-based）

1. 取趟次涉及主市场组（`getRouteGroups`：KL / BM / MC / A / KD …）。
2. 查 `route_master.sadoo_mileage_km` 得各组到 SADAO 里程 `M(group)`。
3. **市场次序**：按距离 **先近后远** 排序（默认 `sadoo_mileage_km` 升序；**不要求**调度录入 visit order）。
4. 拆段：
   - `Leg0`：SADAO → G₁，距离 `Δ₀ = M(G₁)`
   - `Leg i`：Gᵢ₋₁ → Gᵢ，距离 `Δᵢ = M(Gᵢ) − M(Gᵢ₋₁)`
5. 每段产生油费/维修/过路费；分摊：
   - **Leg0**：摊给 **全车所有货**（按桶数比例）
   - **Leg i (i≥1)**：只摊给 **目的地在该段及之后市场组的货**

**守恒**：各段分摊之和 = 原「最远市场里程」整车池（仅改变分配，月度 variable 车辆费总额基本不变，±舍入）。

**BM50+MC100 数值示意**（油+维保综合 0.5 MYR/km）：

| 段 | 里程 | 段费 | BM 50 桶 | MC 100 桶 |
|----|------|------|----------|-----------|
| SADAO→BM | 350 km | 175 | 175×50/150 ≈ 58.33 | 175×100/150 ≈ 116.67 |
| BM→MC（独享） | 950 km | 475 | 0 | 475 |
| **合计** | | **650** | **≈58.33** | **≈591.67** |

（旧逻辑：全车 1300 km 池按 50/150、100/150 平摊 → BM 被摊远途，本方案纠正。）

### 2.3 MC 转第三方

- **规则**：MC 货 **不摊** 车辆成本、过路费（与现有下货费不摊 MC 规则对齐，commit `9aea58a` 意图）。
- **现状缺口**：车辆成本分摊分母仍含 MC 桶（`vehicleAllocationDenominator = totalTripQuantity`）；**本次实施须改对齐**。
- 路线成本计算：`effectiveMarketsForTripCost` 已在 MC 全第三方时剔除 MC 里程；分摊侧须一致剔除 MC 货。

---

## 3. 七项决策定稿

| # | 决策 | 定稿内容 |
|---|------|----------|
| **1** | 车辆成本模型 | **分段里程法（leg-based）**；总池守恒，只改分配 |
| **2** | MC 转第三方 | **不摊车辆成本/过路**；与下货费剔除 MC 对齐；**改现有未对齐代码** |
| **3** | 过路 / 停车 | **过路按段**；**停车按市场**，归入 **下货费** 一类（与 Upah Turun/KPB 同按市场归属） |
| **4** | 市场次序 | **按距离先近后远**；默认 `sadoo_mileage_km` 排序；不要求调度录 visit order |
| **5** | 停车费存储 | **按市场一步到位**（`market_actuals` 含 `fee_type=parking`）；**不分 B1/B2** |
| **6** | 历史数据 | **全部重算**；系统 2026-06-01 起录入，仅 6 月一个月；新算法 **全量生效**，无旧账顾虑 |
| **7** | 发布策略 | **A + B + C 一起做、一起上**（连环扣）；一次到位，仔细测 |

---

## 4. 三块实施方案

### 4.A 成本闸门（⑤⑥）

| 项 | 定稿 |
|----|------|
| 读真实条件 | 仅 `confirmed` / `approved`（且 `cost_applied_at` 有效） |
| 未审状态 | `draft` / `clerk_entered` / `pending_review` / `rejected` → 读 **路线/费率估算**；不读未审 voucher `*Amt`、不读未生效 override |
| writeback 时机 | **取消** save 即 writeback；**仅** confirm/approve 时 `applyVoucherCostActuals` |
| 打回 | `rejected` → `clearVoucherCostActuals`（清 override）；草稿 `market_actuals` 保留可改 |
| 统一模块 | `voucher-cost-resolver`（纳入 `trip-cost-engine`） |
| 改造面 | `pnl-report.ts`、`operations-cost.ts`、transition 流程 |

### 4.B 按市场实际值

| 项 | 定稿 |
|----|------|
| 业务范围 | 停车、下货（Upah Turun）、KPB — **每市场各自填** |
| 草稿存储 | 新表 **`driver_voucher_market_actuals`**：`voucher_id`, `fee_type` (`parking` \| `kpb` \| `unload`), `display_market`, `amount` |
| 生效存储 | KPB/下货 → `unloading_fees.kpb_fee_override` / `unload_fee_override`（已有 `@@unique([tripId, market])`） |
| 停车费 | 实际值现 **无** 按市场存储 → **必须** 用 `market_actuals`；apply 后汇总到 `voucher.parking_actual`（belanja/打印/audit） |
| 取消逻辑 | **删除** 保存时 `allocateByProportion` 比例 writeback；confirm 时 **1:1** 按市场映射写 override |
| voucher 标量 | `kpb_actual` / `upah_turun_actual` / `parking_actual` = `SUM(market_actuals)` 镜像 |
| Module1 | 有 voucher 时 `unloading_fees` override **只读**；实际只在报销单录入 |
| UI | 每市场格可编辑；不再「仅最后一格」绑单字段 |

**展示市场 ↔ `unloading_fees.market` 映射**（实施须单测）：

- KL 组合并 BP/MP/SL
- BM Pindah 虚拟行映射到 P/TP/KT/NT/SA 等 per-trip 行
- 多行时 apply 规则在实现 spec 中写死并测

### 4.C 车辆成本分摊

| 项 | 定稿 |
|----|------|
| 算法 | §2 分段里程 + §2.3 MC 第三方剔除 |
| 分摊粒度 | **inbound line**（按 stall 市场 → route group）；顾客分析按 shipper 汇总 line 结果 |
| 统一引擎 | `trip-cost-engine`：`resolveTripVehiclePool` + `allocateVehicleCostsToLines` |
| 共用 | **P&L** 与 **operations** 必须同一 engine，禁止长期双口径 |
| 全局费 | ① 类费用：全车桶数摊（§2.1） |
| 下货类 | ② 类：按市场桶数，不经全车池（与 B 的 override 一致） |

---

## 5. 关键澄清

| 概念 | 说明 |
|------|------|
| **费率设定**（`/settings` unload-settings 按市场费率表） | **估算基础**；系统已有，**不重建** |
| **`market_actuals` 新表** | 存司机 **实际花费**（按市场草稿）；confirm 前不影响成本 |
| **`unloading_fees` override** | 下货/KPB **已按 (tripId, market) 存**；apply 后作为成本生效源 |
| **`unloading_fees.unload_fee/kpb_fee`** | 系统估算；未审 / 无 override 时 P&L 读此项 |
| **停车费** | 估算来自 route；**实际** 此前无按市场字段 → `market_actuals.fee_type=parking` |
| **鱼检 / 边境等** | 归入 ① 全局或路线类时按 §2.1 / resolver 规则；与 voucher actual 闸门联动（A） |

---

## 6. 数据模型摘要

### 6.1 新增：`driver_voucher_market_actuals`

```text
driver_voucher_market_actuals
  id
  voucher_id          FK → driver_vouchers
  fee_type            'parking' | 'kpb' | 'unload'
  display_market      KL | BM | MC | BM Pindah | A | KD | MC ...
  amount              float?
  created_at / updated_at
  UNIQUE(voucher_id, fee_type, display_market)
```

### 6.2 三层数据流

```text
Layer 1 — 估算     unloading_fees.*_fee / route_master / 费率表
Layer 2 — 草稿     driver_voucher_market_actuals + voucher 标量汇总
Layer 3 — 已生效   override（kpb/unload）+ voucher.*_actual（停车等）+ cost_applied_at
                   仅 status ∈ {confirmed, approved} 时 P&L 读 Layer 3
```

### 6.3 `driver_vouchers` 现有字段

保留 `parking_actual` / `kpb_actual` / `upah_turun_actual` 作汇总与 belanja；**不再**作为比例 writeback 输入源。

---

## 7. 模块结构（目标架构）

```text
lib/trip-cost-engine/
  voucher-cost-resolver.ts    # A: status 闸门，实际 vs 估算
  vehicle-leg-resolver.ts     # C: 分段里程、MC 剔除、池子计算
  line-cost-allocator.ts      # C: 行级分摊 + ①全局费桶数摊
  index.ts                    # 对外 API；pnl-report / operations-cost 唯一入口
```

**状态转换挂钩**（`driver-voucher-status` / transition API）：

- `confirmed` / `approved` → `applyVoucherCostActuals` + 设 `cost_applied_at`
- `rejected` → `clearVoucherCostActuals` + 清 `cost_applied_at`

---

## 8. 安全机制（实施时必做）

### 8.1 Feature flag

```text
VOUCHER_COST_MODE=legacy|shadow|enforced      # A + B
VEHICLE_ALLOC_MODE=legacy|shadow|enforced     # C
```

- **shadow**：新旧并行算，记 diff，不改报表输出
- **enforced**：上线；A+B+C **同一次** 切 enforced

### 8.2 固定月快照

- 脚本：`snapshot-trip-costs.ts`（实施时创建）
- 对象：**2026 年 6 月**全月 before/after
- 输出：每 trip 状态、市场、桶数、legacy vs enforced 车辆池、顾客分摊 diff

### 8.3 验收标准

| 检查项 | 标准 |
|--------|------|
| 车辆费月总额 | legacy ≈ enforced（±舍入）；守恒 |
| confirmed 趟装卸费 | 与手工 / override 一致 |
| BM+MC 趟 | BM 顾客 vehicle 分摊 **下降**，MC **上升**；trip 合计不变 |
| MC 全第三方 | MC 货 vehicle = 0；与下货规则一致 |
| 未审 voucher | P&L 不读 override / 未审 actual |

---

## 9. 影响面清单

| 区域 | 变更 |
|------|------|
| `lib/pnl-report.ts` | `computeTripPnlRow`、顾客分析、行级分摊 |
| `lib/operations-cost.ts` | 整车成本聚合改经 engine |
| `lib/driver-expense-service.ts` | 去 save writeback；apply/clear |
| `lib/mc-dispatch-delivery.ts` | 车辆分摊 MC 剔除（与下货对齐） |
| `components/driver-expenses/*` | 按市场录入 UI |
| `prisma/schema` | `driver_voucher_market_actuals` migration |
| 迁移脚本 | 1 条 confirmed voucher 回填；draft 污染 override 清理 |
| 测试 | resolver、leg 分摊、映射、transition 集成测 |

**不碰**：`UnloadingRateConfig`、`RouteMaster` 费率主数据逻辑本身（只读）。

---

## 10. 实施步骤（建议顺序）

| Step | 内容 | 备注 |
|------|------|------|
| 0 | 本定稿评审通过；①–④ 书记试用稳定 | **当前卡点** |
| 1 | `trip-cost-engine` 骨架 + 单测 | |
| 2 | A resolver + B `market_actuals` schema/API | 可并行 |
| 3 | 去 save writeback；transition apply/clear | 依赖 2 |
| 4 | C leg 分摊 + MC 剔除 + 行级 allocator | 依赖 1 |
| 5 | shadow 跑满 2026-06 月 + diff 报告 | |
| 6 | UI 按市场录入 + Module1 只读 + 打印 | 依赖 2 |
| 7 | **一次 enforced** A+B+C + 全月重算 | ✅ 2026-06-26 生产上线 |
| 8 | 迁移脚本 + 生产验证 | ✅ enforced 已验证；可选 `market_actuals` 回填 2 条待审 |

**风险最高**：Step 7（P&L / 顾客分析数字变动 + 闸门同时生效）。

---

## 11. 实施状态

| 项 | 状态 |
|----|------|
| 方案设计 | ✅ 定稿 |
| 老板决策 | ✅ 七项已定（见 §3） |
| Step 1–6 | ✅ 已上线 `main`（workflow、`market_actuals` UI、shadow 等） |
| **Step 7 — A+B+C enforced** | ✅ **生产生效 2026-06-26**（`VOUCHER_COST_MODE=enforced` + `VEHICLE_ALLOC_MODE=enforced`） |
| Step 7b 修复 | ✅ `883f222` — 无 voucher 读估算、MC 全第三方池对齐、守恒断言、缓存 key 含 flag |
| Step 8 — 历史 voucher 迁移 | ⏸ **待审** — 见下方生产核查结论 |

### 7 生产上线验证（2026-06-26）

| 检查项 | 结果 |
|--------|------|
| 全月毛利守恒 | legacy **242,640.75** → enforced **242,640.61**（Δ **-0.14** 舍入） |
| Shadow 车辆池守恒 | 146,933.92 → 146,934.06（Δ +0.14）✓ |
| 顾客方向 | SAHASIN - SK 毛利 ↑ **7,355.59**；SAKDA ↓ **27,684**；59↑ / 17↓ |
| Voucher gate（6 月） | 0 趟装卸费因未审 voucher 误读 |

### 8 历史 voucher 迁移（2026-06-25 生产只读核查）

生产共 **6** 条 voucher（5 confirmed + 1 approved），均有 `cost_applied_at`。

| voucher | status | market_actuals | override | enforced 成本 |
|---------|--------|----------------|----------|---------------|
| V-20260611-001 | confirmed | **0 行**（①-b 迁移） | ✅ kpb/unload/loading | **读真实**（标量 actual + override） |
| V-20260610-001 | confirmed | **0 行** | ✅ kpb/unload/loading | **读真实** |
| V-20260601-001 | approved | 6 行 | ✅ | **读真实** |
| V-20260608-001 | confirmed | 6 行 | ✅ | **读真实** |
| V-20260611-002 | confirmed | 9 行 | ✅ | **读真实** |
| V-20260612-001 | confirmed | 9 行 | ✅ | **读真实** |

**结论**：①-b 迁来的 `V-20260611-001` 虽无 `market_actuals`，但旧 writeback 已写入 `unloading_fees` / `crate_loading_fees` override；enforced 下 **不读估算，P&L 成本正确**。

**可选 housekeeping**（不影响 P&L，待老板审后执行）：为 `V-20260610-001`、`V-20260611-001` 从现有 override + 标量 **回填 `market_actuals`**，便于 UI 按市场编辑；幂等 dry-run 脚本待审。

| Git | ✅ Step 7a `b439880`、Step 7b `883f222` 已 push `main` |

---

## 12. 参考

- 前期调查对话与 v1/v2 方案草稿（agent transcript）
- `docs/voucher-writeback-test-report-2026-06-16.md` — writeback 行为实测
- `lib/operations-cost.ts` — 现 `computeTripRouteCosts`（MAX 里程）
- `lib/pnl-report.ts` — 现 `allocateShare` 桶数分摊
- `lib/mc-dispatch-delivery.ts` — MC 第三方、`pnlUnloadAllocatableQuantity`
- Commit `9aea58a` — 下货费不摊 MC 第三方意图

---

## 13. 附录：包车司机费用单 → P&L（Charter Voucher，批次 1–7）

> **状态**：批次 1–7 已上线（schema phase 1 + 覆盖/新增 + 缓存/reopen/删单，2026-06）。  
> **与 dispatch 关系**：包车走 `tripSource=charter` 独立路径；**不**走 `unloading_fees` / `crate_loading_fees` dispatch writeback。

### 13.1 报销单六类字段：哪些进 P&L

| 报销字段 | 中文 | 进 P&L？ | 机制 |
|----------|------|---------|------|
| `upahTurunActual` | 下货费 Upah Turun | ✅ | 覆盖 `charterUnloadFeeMyr` 估算（批次 2） |
| `otherActual` | 其他 Other | ✅ | 覆盖 `charterOtherCostMyr` 估算（批次 3） |
| `chopBorderActual` | Chop/Border | ✅（仅 borderPass 部分） | 覆盖全局 `borderPass`；**不**覆盖 epermit/dagang/forwarding（批次 4） |
| `upahNaikTongActual` | 上桶费 Upah Naik Tong | ✅ | **新成本项** `charterLoadingLaborMyr`；无估算，eligible 计 actual、否则 0（批次 5） |
| `minyakMotoActual` | 摩托油 | ❌ | 仅 belanja / 打印；不进 P&L |
| `duitJalan` | 路钱（预付） | ❌ | 仅 belanja / baki；**不进** P&L、不进 belanja 合计 |

**belanja** = 上述 P&L 相关 actual 之和（charter 分支不含 duitJalan）。**baki** = `duitJalan − belanja`。

**不进 P&L 的固定/估算项（不受 voucher 覆盖，并存独立）：**

- `charterDriverSalaryMyr` — 司机固定工钱（与上桶费劳务 **并存**，互不替代）
- `computedCrateRentalMyr` — 公司租桶费（与上桶费 **完全无关**）
- `computedLkimMyr`、extra items、车辆油费/维修、`toll` 等 — 原 charter P&L 逻辑不变

### 13.2 生效闸门（eligible）

与 dispatch 一致，读 **已生效实际值** 须同时满足：

```text
tripSource = 'charter'
status ∈ { confirmed, approved }
cost_applied_at IS NOT NULL
```

未满足（无 voucher / draft / pending_review / rejected / reopen 后 clerk_entered）→

- unload / other / borderPass：**回退估算**（上桶费回 **0**）
- 上桶费：始终 **0**（无估算可回退）

**写入时机**：仅 confirm / approve 时 `applyCharterVoucherCostActuals`；**不**在 save 时 writeback。

**打回 / reopen 清列**：`clearCharterVoucherCostActuals` 清空四列 override / loading：

- `charterUnloadFeeOverride`
- `charterOtherCostOverride`
- `charterBorderPassOverride`
- `charterLoadingLaborMyr`

### 13.3 五项 P&L 成本机制（批次 2–5）

| 批次 | 项 | 规则 | 双计防护 |
|------|-----|------|----------|
| 2 | 下货 unload | `effective = eligible && override≠null ? override : estimate` | 二选一，never estimate+override |
| 3 | 其他 other | 同上 | 同上 |
| 4 | 边境 borderPass | 只替换 `borderPass`；`exceptPass = epermit+dagang+forwarding` 始终估算 | 总额 = effectivePass + exceptPass |
| 4b | `includeBorderFees=false` | 读取时 borderPass=0（即使有 override） | 边境费总额=0 |
| 5 | 上桶 loading labor | `eligible && loading≠null ? loading : 0` | 新项，无估算，无双计 |

**同单四项独立**：totalCost Δ = ΔUnload + ΔOther + ΔBorderPass + loadingLabor（各自独立，无交叉）。

### 13.4 ADMIN reopen（批次 fix）

- **权限**：仅 `admin`
- **从**：`confirmed` / `approved` → **`clerk_entered`**（可编辑后重新 confirm/approve）
- **行为**：`clearCharterVoucherCostActuals` → P&L 回估算/0；`change_logs.eventType = reopen`
- **API**：`POST /api/driver-vouchers/[id]/reopen`

### 13.5 删包车单 + P&L 缓存（批次 fix）

- **`deleteCharterTrip`**：事务内 `deleteMany driver_vouchers WHERE tripId AND tripSource='charter'`（**不**误删 dispatch voucher），再删 trip
- **缓存**：`invalidatePnlTripsCache()` — 清 `pnlMonthTripsCache` + `revalidatePath('/reports/pnl')`
- **触发**：save/delete charter、voucher transition/reopen、apply/clear charter/dispatch cost actuals

### 13.6 代码入口

```text
lib/charter-voucher-cost-resolver.ts   # eligible + resolve* + computeCharterEffectiveBorderFeesMyr
lib/driver-expense/charter-voucher-cost-apply.ts
lib/charter-pnl.ts                     # computeCharterPnlRow
lib/charter-operations.ts              # 运营报表同口径
lib/pnl-report.ts                      # charter 行并入 P&L 列表/顾客
lib/charter-voucher-lifecycle.integration.test.ts  # 批次 2–5 生命周期集成测
```

### 13.7 生产只读验算（本地脚本，不提交）

```bash
npx tsx scripts/_verify-charter-voucher-batch7-full-regression.ts 2026 6
```

检查：无 eligible 趟 totalCost 与纯估算一致；有 eligible 趟 actual= effective；运营 charter 汇总与 P&L 逐项 diff=0；dispatch 路径不受 charter 泄漏。

---

*本文档为实施唯一依据；任何偏离须先更新本文档并重新评审。*
