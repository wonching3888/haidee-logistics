# Voucher Writeback Integrity Test Report (2026-06-16)

## Scope

- Target module: `/documents/driver-expenses` Voucher save flow
- Runtime test method: synthetic trip data created in DB, then `updateDriverVoucher()` invoked, then before/after snapshots compared.
- Static audit method: global code search for write paths and report read logic.

## Verification 1: Voucher save does not mutate rate/config tables

### Tables checked

- `UnloadingRateConfig`
- `CrateLoadingRateConfig`
- `RouteMaster`
- `GlobalCostSetting`

### Test steps

1. Snapshot all four tables before Voucher update.
2. Create synthetic voucher + related `UnloadingFee` and `CrateLoadingFee` rows.
3. Save voucher actuals via `updateDriverVoucher()`.
4. Snapshot the same four tables after update.
5. Compare snapshots.

### Result

- **Pass**
- Before/after snapshots are byte-equal (`immut = true`).
- No runtime mutation observed in any config table.

### Static write-path audit

- `createDriverVoucher` / `updateDriverVoucher` / `writebackVoucherActuals` only write:
  - `driverVoucher`
  - `unloadingFee`
  - `crateLoadingFee`
- No `update`/`upsert` to the above four config tables inside voucher save/writeback paths.

- **Pass**

---

## Verification 2: Actual values write back correctly

### 2.1 `kpbActual -> UnloadingFee.kpbFeeOverride`

- Input: `kpbActual = 110`
- Baseline weights: `kpbFee` = 20 and 80
- Expected proportional writeback: 22 and 88
- Observed: 22 and 88

- **Pass**

### 2.2 `upahTurunActual -> UnloadingFee.unloadFeeOverride`

- Input: `upahTurunActual = 55`
- Baseline weights: `unloadFee` = 30 and 70
- Expected proportional writeback: 16.5 and 38.5
- Observed: 16.5 and 38.5

- **Pass**

### 2.3 `upahNaikTongActual -> CrateLoadingFee.loadingFeeOverride`

- Input: `upahNaikTongActual = 75`
- Baseline weights: `loadingFee` = 40 and 60
- Expected proportional writeback: 30 and 45
- Observed: 30 and 45

- **Pass**

### 2.4 `chopBorderActual / parkingActual / fishCheckActual` storage scope

- Saved values persisted in `DriverVoucher` (`8/9/7` in test).
- No writeback to `UnloadingFee`/`CrateLoadingFee` fields for these 3 items.

- **Pass**

---

## Verification 3: Report read priority

Required priority:

1. KPB: `kpbFeeOverride` > `kpbFee`
2. Unload: `unloadFeeOverride` > `unloadFee`
3. Loading: `loadingFeeOverride` > `loadingFee`
4. Chop/Parking/Fish: Voucher actual > estimated

### Static audit result

- `lib/pnl-report.ts` currently computes direct unload via `unloadRateMap` and route/global estimates.
- `lib/operations-cost.ts` currently aggregates route/global estimates and unload-rate-derived values.
- Neither path currently reads:
  - `unloading_fees` overrides as report source of truth
  - `crate_loading_fees.loadingFeeOverride`
  - `driver_vouchers` actuals (`chopBorderActual/parkingActual/fishCheckActual`)

- **Fail**

### Notes

- This is a separate report-layer logic gap, not a voucher writeback bug.
- Voucher writeback itself is functioning correctly.

