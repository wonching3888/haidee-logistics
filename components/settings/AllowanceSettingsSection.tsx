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
import { GlobalCostSettingsSection } from "@/components/settings/GlobalCostSettingsSection";
import type { GlobalCostSettingRow } from "@/lib/global-cost-settings-service";

interface RouteAllowanceRow {
  id: string;
  code: string;
  name: string;
  markets: string[];
  driverAllowance: number | null;
}

interface PayrollSettingsSectionProps {
  globalCosts: GlobalCostSettingRow[];
  routes: RouteAllowanceRow[];
  extraMarketAllowance: number;
  bigTruckCrateCommission: number | null;
  smallTruckCrateCommission: number | null;
}

export function PayrollSettingsSection({
  globalCosts,
  routes,
  extraMarketAllowance,
  bigTruckCrateCommission,
  smallTruckCrateCommission,
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
  }, [
    routes,
    extraMarketAllowance,
    bigTruckCrateCommission,
    smallTruckCrateCommission,
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
        A → A 路线津贴 + RM30。
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

      <GlobalCostSettingsSection
        settings={globalCosts}
        title="全局费用 Global Trip Costs"
        tripCostsOnly
      />
    </div>
  );
}

/** @deprecated Use PayrollSettingsSection */
export const AllowanceSettingsSection = PayrollSettingsSection;
