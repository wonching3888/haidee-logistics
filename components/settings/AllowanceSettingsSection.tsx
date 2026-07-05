"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveAllowanceSettings } from "@/app/actions/allowance-settings";
import { formatRouteMarkets } from "@/components/settings/RouteFormDialog";

interface RouteAllowanceRow {
  id: string;
  code: string;
  name: string;
  markets: string[];
  driverAllowance: number | null;
}

interface PayrollSettingsSectionProps {
  routes: RouteAllowanceRow[];
  extraMarketAllowance: number;
  bigTruckCrateCommission: number | null;
  smallTruckCrateCommission: number | null;
  bpCrateCommissionBigTruck: number | null;
  bpCrateCommissionSmallTruck: number | null;
  crateReturnMultiMarketAllowance: number;
}

export function PayrollSettingsSection({
  routes,
  extraMarketAllowance,
  bigTruckCrateCommission,
  smallTruckCrateCommission,
  bpCrateCommissionBigTruck,
  bpCrateCommissionSmallTruck,
  crateReturnMultiMarketAllowance,
}: PayrollSettingsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState<Record<string, string>>({});
  const [extraMarket, setExtraMarket] = useState(String(extraMarketAllowance));
  const [bigTruckCrate, setBigTruckCrate] = useState(
    bigTruckCrateCommission != null ? String(bigTruckCrateCommission) : ""
  );
  const [smallTruckCrate, setSmallTruckCrate] = useState(
    smallTruckCrateCommission != null ? String(smallTruckCrateCommission) : ""
  );
  const [bpBigTruckCrate, setBpBigTruckCrate] = useState(
    bpCrateCommissionBigTruck != null ? String(bpCrateCommissionBigTruck) : ""
  );
  const [bpSmallTruckCrate, setBpSmallTruckCrate] = useState(
    bpCrateCommissionSmallTruck != null ? String(bpCrateCommissionSmallTruck) : ""
  );
  const [crateReturnMultiMarket, setCrateReturnMultiMarket] = useState(
    String(crateReturnMultiMarketAllowance)
  );

  useEffect(() => {
    setRouteForm(
      Object.fromEntries(
        routes.map((route) => [
          route.id,
          route.driverAllowance != null ? String(route.driverAllowance) : "",
        ])
      )
    );
    setExtraMarket(String(extraMarketAllowance));
    setBigTruckCrate(
      bigTruckCrateCommission != null ? String(bigTruckCrateCommission) : ""
    );
    setSmallTruckCrate(
      smallTruckCrateCommission != null ? String(smallTruckCrateCommission) : ""
    );
    setBpBigTruckCrate(
      bpCrateCommissionBigTruck != null ? String(bpCrateCommissionBigTruck) : ""
    );
    setBpSmallTruckCrate(
      bpCrateCommissionSmallTruck != null
        ? String(bpCrateCommissionSmallTruck)
        : ""
    );
    setCrateReturnMultiMarket(String(crateReturnMultiMarketAllowance));
  }, [
    routes,
    extraMarketAllowance,
    bigTruckCrateCommission,
    smallTruckCrateCommission,
    bpCrateCommissionBigTruck,
    bpCrateCommissionSmallTruck,
    crateReturnMultiMarketAllowance,
  ]);

  function parseOptionalRate(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} 不能为负数`);
    }
    return parsed;
  }

  function runSaveAllowances() {
    setError(null);
    startTransition(async () => {
      try {
        await saveAllowanceSettings({
          routeAllowances: routes.map((route) => ({
            routeId: route.id,
            driverAllowance: parseOptionalRate(
              routeForm[route.id] ?? "",
              `${route.code} 路线津贴`
            ),
          })),
          extraMarketAllowance: parseOptionalRate(extraMarket, "额外市场津贴"),
          bigTruckCrateCommission: parseOptionalRate(
            bigTruckCrate,
            "大车回桶提成"
          ),
          smallTruckCrateCommission: parseOptionalRate(
            smallTruckCrate,
            "小车回桶提成"
          ),
          bpCrateCommissionBigTruck: parseOptionalRate(
            bpBigTruckCrate,
            "BP 大车回桶提成"
          ),
          bpCrateCommissionSmallTruck: parseOptionalRate(
            bpSmallTruckCrate,
            "BP 小车回桶提成"
          ),
          crateReturnMultiMarketAllowance: parseOptionalRate(
            crateReturnMultiMarket,
            "回桶多市场补贴"
          ),
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        每趟津贴 = 该趟最高路线津贴 +（额外市场数 × 额外市场津贴）。例：KD +
        A → A 路线津贴 + RM30。仅显示马来西亚派车路线；宋卡/北大年泰国路线请在「泰国成本设置」维护。
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-haidee-border bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-haidee-text">
          路线津贴 Route Allowances (MYR/趟)
        </h3>
        <div className="overflow-x-auto rounded-lg border border-haidee-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>路线 Route</TableHead>
                <TableHead>包含市场 Markets</TableHead>
                <TableHead>津贴 Allowance (MYR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell>
                    <div className="font-medium">{route.name}</div>
                    <div className="font-mono text-xs text-haidee-muted">
                      {route.code}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatRouteMarkets(route.markets)}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={routeForm[route.id] ?? ""}
                      onChange={(e) =>
                        setRouteForm({
                          ...routeForm,
                          [route.id]: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="min-h-[44px] font-mono"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-lg border border-haidee-border bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-haidee-text">
          全局津贴 Global Allowances
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            额外市场津贴 Extra Market (MYR/市场)
            <Input
              value={extraMarket}
              onChange={(e) => setExtraMarket(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            大车回桶提成 Big Truck (MYR/趟)
            <Input
              value={bigTruckCrate}
              onChange={(e) => setBigTruckCrate(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            小车回桶提成 Small Truck (MYR/趟)
            <Input
              value={smallTruckCrate}
              onChange={(e) => setSmallTruckCrate(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </label>
        </div>
        <h4 className="mb-2 mt-4 text-sm font-semibold text-haidee-text">
          BP 专程回桶提成 BP Crate Return Commission
        </h4>
        <p className="mb-3 text-xs text-haidee-muted">
          当 date+plate 回收含 BP 市场且 qty&gt;0 时使用此费率（一趟一次，不与其他市场叠加）。
          When a return includes BP market, use these rates (one commission per return).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            BP 大车 Big Truck (MYR)
            <Input
              value={bpBigTruckCrate}
              onChange={(e) => setBpBigTruckCrate(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            BP 小车 Small Truck (MYR)
            <Input
              value={bpSmallTruckCrate}
              onChange={(e) => setBpSmallTruckCrate(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </label>
        </div>
        <h4 className="mb-2 mt-4 text-sm font-semibold text-haidee-text">
          回桶多市场补贴 Crate Return Multi-Market Bonus
        </h4>
        <p className="mb-3 text-xs text-haidee-muted">
          同一车同日回桶来自 2 个不同主要市场（qty&gt;0，BM 组算 1 个）时额外补贴，与出货路线津贴无关。
        </p>
        <label className="block max-w-xs space-y-1 text-sm">
          回桶多市场补贴 (MYR/趟，封顶一次)
          <Input
            value={crateReturnMultiMarket}
            onChange={(e) => setCrateReturnMultiMarket(e.target.value)}
            className="min-h-[44px] font-mono"
          />
        </label>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={runSaveAllowances}
          >
            保存薪资设定 Save Payroll Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use PayrollSettingsSection */
export const AllowanceSettingsSection = PayrollSettingsSection;
