"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { Button } from "@/components/ui/button";
import {
  getAssignableItems,
  saveDispatchOrder,
  type AssignableItem,
  type DispatchSelection,
} from "@/app/actions/dispatch";
import { MC_MARKET_CODE } from "@/lib/inbound-freight";

interface TruckOption {
  id: string;
  plate: string;
  type: string;
  capacityTong: number | null;
  defaultDriverId: string | null;
  defaultDriverName: string;
}

interface DriverOption {
  id: string;
  name: string;
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
  drivers: DriverOption[];
  marketOptions: string[];
  date: string;
  initialOrder?: InitialOrder;
}

function selectionKey(selection: DispatchSelection): string {
  return selection.sessionId
    ? `${selection.sessionId}:${selection.marketCode}`
    : `${selection.shipperId}:${selection.marketCode}`;
}

export function DispatchForm({
  trucks,
  drivers,
  marketOptions,
  date,
  initialOrder,
}: DispatchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [truckId, setTruckId] = useState(initialOrder?.truckId ?? "");
  const [selectedDriverId, setSelectedDriverId] = useState(() => {
    if (initialOrder?.driverName) {
      const matched = drivers.find((d) => d.name === initialOrder.driverName);
      if (matched) return matched.id;
    }
    const truck = trucks.find((t) => t.id === initialOrder?.truckId);
    return truck?.defaultDriverId ?? "";
  });
  const [markets, setMarkets] = useState<string[]>(initialOrder?.markets ?? []);
  const [items, setItems] = useState<AssignableItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(initialOrder?.selections.map((s) => selectionKey(s)) ?? [])
  );
  const [thirdPartyKeys, setThirdPartyKeys] = useState<Set<string>>(
    new Set(
      initialOrder?.selections
        .filter((s) => s.thirdParty && s.marketCode === MC_MARKET_CODE)
        .map((s) => selectionKey(s)) ?? []
    )
  );
  const [splitKeys, setSplitKeys] = useState<Set<string>>(new Set());
  const [splitQty, setSplitQty] = useState<Record<string, string>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [marketsWithCargo, setMarketsWithCargo] = useState<Set<string>>(
    new Set()
  );

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

  const visibleMarketOptions = useMemo(
    () =>
      marketOptions.filter(
        (code) => marketsWithCargo.has(code) || markets.includes(code)
      ),
    [marketOptions, marketsWithCargo, markets]
  );

  useEffect(() => {
    if (marketOptions.length === 0) {
      setMarketsWithCargo(new Set());
      return;
    }
    getAssignableItems(date, marketOptions, initialOrder?.id).then((data) => {
      setMarketsWithCargo(new Set(data.map((item) => item.marketCode)));
    });
  }, [date, marketOptions.join(","), initialOrder?.id]);

  useEffect(() => {
    if (markets.length === 0) {
      setItems([]);
      setSelectedKeys(new Set());
      setThirdPartyKeys(new Set());
      setSplitKeys(new Set());
      setSplitQty({});
      return;
    }
    setLoadingItems(true);
    setSelectedKeys(new Set());
    setThirdPartyKeys(new Set());
    setSplitKeys(new Set());
    setSplitQty({});
    getAssignableItems(date, markets, initialOrder?.id)
      .then((data) => {
        setItems(data);
        if (initialOrder?.selections.length) {
          setSelectedKeys(
            new Set(initialOrder.selections.map((s) => selectionKey(s)))
          );
          setThirdPartyKeys(
            new Set(
              initialOrder.selections
                .filter(
                  (s) => s.thirdParty && s.marketCode === MC_MARKET_CODE
                )
                .map((s) => selectionKey(s))
            )
          );
        }
      })
      .finally(() => setLoadingItems(false));
  }, [date, markets.join(","), initialOrder?.id]);

  function toggleMarket(code: string) {
    setMarkets((prev) => {
      if (prev.includes(code)) return prev.filter((m) => m !== code);
      return [...prev, code];
    });
  }

  function toggleItem(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setThirdPartyKeys((tp) => {
          if (!tp.has(key)) return tp;
          const nextTp = new Set(tp);
          nextTp.delete(key);
          return nextTp;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleThirdParty(key: string) {
    setThirdPartyKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setSelectedKeys((sel) => {
          if (sel.has(key)) return sel;
          const nextSel = new Set(sel);
          nextSel.add(key);
          return nextSel;
        });
      }
      return next;
    });
  }

  function selectAllCargo() {
    setSelectedKeys(
      new Set(items.filter((item) => !splitKeys.has(item.key)).map((i) => i.key))
    );
  }

  function deselectAllCargo() {
    setSelectedKeys(new Set());
    setThirdPartyKeys(new Set());
  }

  function markSelectedMcThirdParty() {
    setThirdPartyKeys((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (
          item.marketCode === MC_MARKET_CODE &&
          selectedKeys.has(item.key) &&
          !splitKeys.has(item.key)
        ) {
          next.add(item.key);
        }
      }
      return next;
    });
  }

  function markSelectedMcSelf() {
    setThirdPartyKeys((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (item.marketCode === MC_MARKET_CODE && selectedKeys.has(item.key)) {
          next.delete(item.key);
        }
      }
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
                updated[stall.inboundLineId] = "";
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
          .map((stall) => {
            const quantity =
              parseInt(splitQty[stall.inboundLineId] ?? "0", 10) || 0;
            if (quantity > stall.quantity) {
              throw new Error(
                `${item.shipperName} ${stall.stallCode} 此车数量不能超过 ${stall.quantity}`
              );
            }
            return { inboundLineId: stall.inboundLineId, quantity };
          })
          .filter((s) => s.quantity > 0);

        if (stallAssignments.length > 0) {
          selections.push({
            shipperId: item.shipperId,
            marketCode: item.marketCode,
            sessionId: item.sessionId,
            stallAssignments,
            thirdParty: thirdPartyKeys.has(item.key),
          });
        }
      } else if (isSelected) {
        selections.push({
          shipperId: item.shipperId,
          marketCode: item.marketCode,
          sessionId: item.sessionId,
          thirdParty: thirdPartyKeys.has(item.key),
        });
      }
    }

    return selections;
  }

  function handleSave() {
    setError(null);
    let selections: DispatchSelection[];
    try {
      selections = buildSelections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "拆分数量无效 Invalid split quantity");
      return;
    }

    startTransition(async () => {
      try {
        const driverName =
          drivers.find((d) => d.id === selectedDriverId)?.name ?? "";

        await saveDispatchOrder({
          date,
          truckId,
          driverName,
          markets,
          selections,
          dispatchOrderId: initialOrder?.id,
        });
        router.replace(`/dispatch?date=${encodeURIComponent(date)}`);
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
            onChange={(e) => {
              const nextTruckId = e.target.value;
              setTruckId(nextTruckId);
              const truck = trucks.find((t) => t.id === nextTruckId);
              setSelectedDriverId(truck?.defaultDriverId ?? "");
            }}
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
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm"
          >
            <option value="">— 选择司机 Select —</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-haidee-border bg-white p-4">
        <label className="mb-3 block text-sm font-medium text-haidee-text">
          目的市场 Markets
        </label>
        <div className="flex flex-wrap gap-2">
          {visibleMarketOptions.map((code) => {
            const checked = markets.includes(code);
            return (
              <label
                key={code}
                className="flex min-h-[40px] cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMarket(code)}
                  className="h-4 w-4 accent-haidee-navy"
                />
                <DispatchMarketLabel code={code} selected={checked} showDisplayName />
              </label>
            );
          })}
        </div>
      </div>

      {markets.length > 0 && (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-haidee-border bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-haidee-text">
            勾选货物 Select Cargo
          </h3>
          <p className="mb-3 text-xs text-haidee-muted">
            仅显示今日未分配货物 Unassigned cargo for this date only
          </p>
          {!loadingItems && items.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllCargo}
              >
                全选 Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deselectAllCargo}
              >
                全不选 Deselect All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={markSelectedMcThirdParty}
              >
                勾选的 MC 全转第三方
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={markSelectedMcSelf}
              >
                全部改回自送
              </Button>
            </div>
          )}
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
                    {item.marketCode === MC_MARKET_CODE &&
                      !splitKeys.has(item.key) &&
                      selectedKeys.has(item.key) && (
                        <div className="flex shrink-0 rounded-lg border border-haidee-border p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (thirdPartyKeys.has(item.key)) {
                                toggleThirdParty(item.key);
                              }
                            }}
                            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                              !thirdPartyKeys.has(item.key)
                                ? "bg-haidee-blue text-white"
                                : "text-haidee-muted hover:text-haidee-text"
                            }`}
                          >
                            自送
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!thirdPartyKeys.has(item.key)) {
                                toggleThirdParty(item.key);
                              }
                            }}
                            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                              thirdPartyKeys.has(item.key)
                                ? "bg-haidee-orange text-white"
                                : "text-haidee-muted hover:text-haidee-text"
                            }`}
                          >
                            转第三方
                          </button>
                        </div>
                      )}
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
          onClick={() =>
            router.push(`/dispatch?date=${encodeURIComponent(date)}`)
          }
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
