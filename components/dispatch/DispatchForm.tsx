"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAssignableItems,
  saveDispatchOrder,
  type AssignableItem,
  type DispatchSelection,
} from "@/app/actions/dispatch";
import { DISPATCH_MARKET_ORDER } from "@/lib/markets";

interface TruckOption {
  id: string;
  plate: string;
  type: string;
  capacityTong: number | null;
}

interface InitialOrder {
  id: string;
  dispatchNo: string | null;
  date: Date;
  truckId: string;
  driverName: string;
  markets: string[];
  selections: DispatchSelection[];
}

interface DispatchFormProps {
  trucks: TruckOption[];
  date: string;
  initialOrder?: InitialOrder;
}

export function DispatchForm({ trucks, date, initialOrder }: DispatchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [truckId, setTruckId] = useState(initialOrder?.truckId ?? "");
  const [driverName, setDriverName] = useState(initialOrder?.driverName ?? "");
  const [markets, setMarkets] = useState<string[]>(initialOrder?.markets ?? []);
  const [items, setItems] = useState<AssignableItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(
      initialOrder?.selections.map((s) =>
        s.sessionId
          ? `${s.sessionId}:${s.marketCode}`
          : `${s.shipperId}:${s.marketCode}`
      ) ?? []
    )
  );
  const [splitKeys, setSplitKeys] = useState<Set<string>>(new Set());
  const [splitQty, setSplitQty] = useState<Record<string, string>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  const selectedTruck = trucks.find((t) => t.id === truckId);
  const capacity = selectedTruck?.capacityTong ?? 0;

  const selectedQty = useMemo(() => {
    let total = 0;
    for (const item of items) {
      if (splitKeys.has(item.key)) {
        for (const stall of item.stalls) {
          if (stall.isBox) continue;
          total += parseInt(splitQty[stall.inboundLineId] ?? "0", 10) || 0;
        }
      } else if (selectedKeys.has(item.key)) {
        total += item.crateQuantity;
      }
    }
    return total;
  }, [items, selectedKeys, splitKeys, splitQty]);

  const loadPct =
    capacity > 0 ? Math.round((selectedQty / capacity) * 100) : 0;

  const loadColor =
    loadPct > 100 ? "#E63946" : loadPct >= 90 ? "#FF9800" : "#2E7D32";

  useEffect(() => {
    if (markets.length === 0) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    getAssignableItems(date, markets, initialOrder?.id)
      .then((data) => setItems(data))
      .finally(() => setLoadingItems(false));
  }, [date, markets.join(","), initialOrder?.id]);

  function toggleMarket(code: string) {
    setMarkets((prev) => {
      if (prev.includes(code)) return prev.filter((m) => m !== code);
      if (prev.length >= 4) return prev;
      return [...prev, code];
    });
  }

  function toggleItem(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSplit(key: string) {
    setSplitKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        const item = items.find((i) => i.key === key);
        if (item) {
          setSplitQty((q) => {
            const updated = { ...q };
            for (const stall of item.stalls) {
              if (!(stall.inboundLineId in updated)) {
                updated[stall.inboundLineId] = String(stall.quantity);
              }
            }
            return updated;
          });
        }
      }
      return next;
    });
  }

  function buildSelections(): DispatchSelection[] {
    const selections: DispatchSelection[] = [];

    for (const item of items) {
      const isSplit = splitKeys.has(item.key);
      const isSelected = selectedKeys.has(item.key);

      if (isSplit) {
        const stallAssignments = item.stalls
          .map((stall) => ({
            inboundLineId: stall.inboundLineId,
            quantity: parseInt(splitQty[stall.inboundLineId] ?? "0", 10) || 0,
          }))
          .filter((s) => s.quantity > 0);

        if (stallAssignments.length > 0) {
          selections.push({
            shipperId: item.shipperId,
            marketCode: item.marketCode,
            sessionId: item.sessionId,
            stallAssignments,
          });
        }
      } else if (isSelected) {
        selections.push({
          shipperId: item.shipperId,
          marketCode: item.marketCode,
          sessionId: item.sessionId,
        });
      }
    }

    return selections;
  }

  function handleSave() {
    setError(null);
    const selections = buildSelections();

    startTransition(async () => {
      try {
        await saveDispatchOrder({
          date,
          truckId,
          driverName,
          markets,
          selections,
          dispatchOrderId: initialOrder?.id,
        });
        router.push("/dispatch");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败 Save failed");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid gap-4 rounded-xl border border-haidee-border bg-white p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            车牌 Plate
          </label>
          <select
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 font-mono text-sm"
          >
            <option value="">— 选择车牌 Select —</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} ({t.capacityTong ?? "?"}桶)
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            司机 Driver
          </label>
          <Input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="Ahmad"
            className="min-h-[44px]"
          />
        </div>
      </div>

      <div className="rounded-xl border border-haidee-border bg-white p-4">
        <label className="mb-3 block text-sm font-medium text-haidee-text">
          目的市场 Markets <span className="text-haidee-muted">(最多4个 max 4)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DISPATCH_MARKET_ORDER.map((code) => {
            const checked = markets.includes(code);
            const disabled = !checked && markets.length >= 4;
            return (
              <label
                key={code}
                className={`flex min-h-[40px] cursor-pointer items-center gap-2 ${
                  disabled ? "cursor-not-allowed opacity-40" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleMarket(code)}
                  className="h-4 w-4 accent-haidee-navy"
                />
                <DispatchMarketLabel code={code} selected={checked} />
              </label>
            );
          })}
        </div>
      </div>

      {markets.length > 0 && (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-haidee-border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-haidee-text">
            勾选货物 Select Cargo
          </h3>
          {loadingItems ? (
            <p className="text-haidee-muted">加载中… Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-haidee-muted">
              所选市场暂无未分配货物 No unassigned cargo for selected markets
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="w-full max-w-3xl rounded-lg border border-haidee-border"
                >
                  <div className="flex min-h-[44px] flex-wrap items-center gap-3 px-4 py-2">
                    {!splitKeys.has(item.key) && (
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(item.key)}
                        onChange={() => toggleItem(item.key)}
                        className="h-5 w-5 rounded border-haidee-border accent-haidee-blue"
                      />
                    )}
                    <span className="font-medium text-haidee-text">
                      {item.shipperName}
                    </span>
                    <DispatchMarketLabel code={item.marketCode} />
                    <span className="ml-auto font-mono text-lg font-semibold">
                      {item.crateQuantity > 0 && `${item.crateQuantity} 桶`}
                      {item.crateQuantity > 0 && item.boxQuantity > 0 && " "}
                      {item.boxQuantity > 0 && `${item.boxQuantity} 盒`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSplit(item.key)}
                      className="shrink-0"
                    >
                      {splitKeys.has(item.key) ? "取消拆分" : "拆分 Split"}
                    </Button>
                  </div>

                  {splitKeys.has(item.key) && (
                    <div className="space-y-2 border-t border-haidee-border bg-haidee-surface/40 px-4 py-3">
                      {item.stalls.map((stall) => {
                        const assign =
                          parseInt(splitQty[stall.inboundLineId] ?? "0", 10) || 0;
                        const remaining = Math.max(0, stall.quantity - assign);
                        return (
                          <div
                            key={stall.inboundLineId}
                            className="flex flex-wrap items-center gap-3 text-sm"
                          >
                            <span className="font-mono font-medium">
                              {stall.stallCode}
                            </span>
                            <DispatchMarketLabel code={item.marketCode} />
                            <span className="text-haidee-muted">
                              共 {stall.quantity}{" "}
                              {stall.isBox ? "盒" : "桶"}
                            </span>
                            <span>此车:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={splitQty[stall.inboundLineId] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v !== "" && !/^\d+$/.test(v)) return;
                                setSplitQty((prev) => ({
                                  ...prev,
                                  [stall.inboundLineId]: v,
                                }));
                              }}
                              className="w-16 rounded border border-haidee-border px-2 py-1 text-right font-mono"
                            />
                            <span
                              className={
                                remaining > 0
                                  ? "text-haidee-orange"
                                  : "text-haidee-green"
                              }
                            >
                              剩余: {remaining}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {truckId && (
        <div className="rounded-xl border border-haidee-border bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-haidee-text">
              已装 Loaded:{" "}
              <span className="font-mono text-lg">{selectedQty}</span> /{" "}
              <span className="font-mono">{capacity || "—"}</span> 桶
            </span>
            {loadPct > 100 && (
              <span className="font-semibold text-haidee-red">
                ❗ 超载 Overload
              </span>
            )}
            {loadPct >= 90 && loadPct <= 100 && (
              <span className="font-semibold text-haidee-orange">⚠️ 接近满载</span>
            )}
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-haidee-border">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, loadPct)}%`,
                backgroundColor: loadColor,
              }}
            />
          </div>
          {loadPct > 100 && (
            <div
              className="mt-0.5 h-1 rounded-full bg-haidee-red"
              style={{ width: `${Math.min(100, loadPct - 100)}%` }}
            />
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-haidee-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dispatch")}
          disabled={isPending}
          className="min-h-[44px]"
        >
          取消 Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending || !truckId || markets.length === 0}
          className="min-h-[44px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          {isPending
            ? "保存中…"
            : initialOrder
              ? "确认修改 Confirm"
              : "确认派车 Confirm Dispatch"}
        </Button>
      </div>
    </div>
  );
}
