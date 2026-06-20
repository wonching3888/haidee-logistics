"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCharterFinance } from "@/app/actions/charter-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CharterClass,
  CharterFinanceRecord,
} from "@/lib/charter-finance";

interface CharterFinanceSectionProps {
  dispatchOrderId: string;
  initial: CharterFinanceRecord | null;
}

function moneyField(value: number | null | undefined) {
  return value != null && value !== 0 ? String(value) : "";
}

function noteField(value: string | null | undefined) {
  return value ?? "";
}

export function CharterFinanceSection({
  dispatchOrderId,
  initial,
}: CharterFinanceSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [charterClass, setCharterClass] = useState<CharterClass>(
    initial?.charterClass ?? "A"
  );
  const [mileageKm, setMileageKm] = useState(
    moneyField(initial?.charterMileageKm)
  );
  const [revenueMyr, setRevenueMyr] = useState(
    moneyField(initial?.charterRevenueMyr)
  );
  const [unloadFeeMyr, setUnloadFeeMyr] = useState(
    moneyField(initial?.charterUnloadFeeMyr)
  );
  const [driverSalaryMyr, setDriverSalaryMyr] = useState(
    moneyField(initial?.charterDriverSalaryMyr)
  );
  const [otherCostMyr, setOtherCostMyr] = useState(
    moneyField(initial?.charterOtherCostMyr)
  );
  const [otherCostNote, setOtherCostNote] = useState(
    noteField(initial?.charterOtherCostNote)
  );
  const [extraRevenueMyr, setExtraRevenueMyr] = useState(
    moneyField(initial?.charterExtraRevenueMyr)
  );
  const [extraRevenueNote, setExtraRevenueNote] = useState(
    noteField(initial?.charterExtraRevenueNote)
  );
  const [extraCostMyr, setExtraCostMyr] = useState(
    moneyField(initial?.charterExtraCostMyr)
  );
  const [extraCostNote, setExtraCostNote] = useState(
    noteField(initial?.charterExtraCostNote)
  );

  function handleSave() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await saveCharterFinance({
          dispatchOrderId,
          charterClass,
          charterMileageKm: mileageKm,
          charterRevenueMyr: revenueMyr,
          charterUnloadFeeMyr: charterClass === "A" ? unloadFeeMyr : null,
          charterDriverSalaryMyr: driverSalaryMyr,
          charterOtherCostMyr: charterClass === "B" ? otherCostMyr : null,
          charterOtherCostNote: charterClass === "B" ? otherCostNote : null,
          charterExtraRevenueMyr: extraRevenueMyr,
          charterExtraRevenueNote: extraRevenueNote,
          charterExtraCostMyr: extraCostMyr,
          charterExtraCostNote: extraCostNote,
        });
        setSuccess("包车财务已保存 Charter finance saved");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败 Save failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-haidee-border bg-white p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-haidee-text">
          包车财务 Charter Finance
        </h3>
        <p className="mt-1 text-xs text-haidee-muted">
          录入本趟包车收入与手动成本项；自动成本（公里/LKIM/租桶）将在 P&L
          阶段接入。
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            包车类型 Class
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="charterClass"
                checked={charterClass === "A"}
                onChange={() => setCharterClass("A")}
                className="h-4 w-4 accent-haidee-navy"
              />
              A 类 — 海产 Seafood
            </label>
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="charterClass"
                checked={charterClass === "B"}
                onChange={() => setCharterClass("B")}
                className="h-4 w-4 accent-haidee-navy"
              />
              B 类 — 普货 General
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              实际公里数 Mileage (km)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={mileageKm}
              onChange={(e) => setMileageKm(e.target.value)}
              placeholder="例如 580"
              className="min-h-[44px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              客户总价 Revenue (MYR)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={revenueMyr}
              onChange={(e) => setRevenueMyr(e.target.value)}
              placeholder="例如 3500"
              className="min-h-[44px] font-mono"
            />
          </div>
        </div>

        {charterClass === "A" ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              下货费 Unload fee (MYR)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unloadFeeMyr}
              onChange={(e) => setUnloadFeeMyr(e.target.value)}
              placeholder="例如 200"
              className="min-h-[44px] font-mono"
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                其他开销 Other cost (MYR)
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={otherCostMyr}
                onChange={(e) => setOtherCostMyr(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                其他开销说明 Note
              </label>
              <Input
                value={otherCostNote}
                onChange={(e) => setOtherCostNote(e.target.value)}
                placeholder="说明此项开销"
                className="min-h-[44px]"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            司机薪资 Driver salary (MYR)
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={driverSalaryMyr}
            onChange={(e) => setDriverSalaryMyr(e.target.value)}
            placeholder="包车固定司机补贴"
            className="min-h-[44px] font-mono"
          />
        </div>

        <div className="rounded-lg border border-dashed border-haidee-border bg-haidee-surface/30 p-4">
          <p className="mb-3 text-xs font-medium text-haidee-muted">
            额外项（A/B 类均可填）Extra items
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                额外收费 Extra revenue (MYR)
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={extraRevenueMyr}
                onChange={(e) => setExtraRevenueMyr(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                额外收费说明 Note
              </label>
              <Input
                value={extraRevenueNote}
                onChange={(e) => setExtraRevenueNote(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                额外开销 Extra cost (MYR)
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={extraCostMyr}
                onChange={(e) => setExtraCostMyr(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                额外开销说明 Note
              </label>
              <Input
                value={extraCostNote}
                onChange={(e) => setExtraCostNote(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="min-h-[44px] bg-haidee-blue px-6 text-white hover:bg-haidee-blue/90"
          >
            {isPending ? "保存中… Saving…" : "保存包车财务 Save Charter Finance"}
          </Button>
        </div>
      </div>
    </div>
  );
}
