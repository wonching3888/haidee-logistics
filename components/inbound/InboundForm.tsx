"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { InboundDeleteButton } from "@/components/inbound/InboundDeleteButton";
import { InboundLineRow } from "@/components/inbound/InboundLineRow";
import { DateInputField } from "@/components/shared/DateInputField";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { isOtherMarket } from "@/lib/markets";
import {
  STICKY_HEAD_FIRST,
  STICKY_HEAD_TOP,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getShipperStalls,
  getThVehiclePlates,
  saveInboundSession,
} from "@/app/actions/inbound";
import {
  computeMarketTotals,
  getDefaultInboundDate,
  toDateInputValue,
} from "@/lib/inbound-utils";
import type { McDeliveryMode } from "@/lib/inbound-freight";
import { MC_MARKET_CODE } from "@/lib/inbound-freight";
import {
  DEFAULT_PICKUP_LOCATION,
  PICKUP_LOCATIONS,
  PICKUP_LOCATION_LABELS,
  resolveSessionPickupLocation,
  tripPickupSaveValue,
  tripPickupSelectValue,
} from "@/lib/constants/pickup-locations";

interface ShipperOption {
  id: string;
  code: string;
  name: string;
  pickupLocation: string;
}

function shipperDefaultPickup(
  shipper: ShipperOption | undefined
): typeof DEFAULT_PICKUP_LOCATION {
  return resolveSessionPickupLocation(null, shipper?.pickupLocation);
}

interface TongTypeOption {
  id: string;
  code: string;
  name: string;
}

interface LineState {
  rowId: string;
  stallId: string;
  stallCode: string;
  marketCode: string;
  tongTypeId: string;
  quantity: string;
  lineId?: string;
  mcDeliveryMode?: McDeliveryMode;
}

function defaultMcDeliveryMode(marketCode: string): McDeliveryMode | undefined {
  return marketCode === MC_MARKET_CODE ? "self" : undefined;
}

function newRowId() {
  return crypto.randomUUID();
}

interface MarketOption {
  id: string;
  code: string;
  name: string;
  displayName?: string;
}

interface InitialSession {
  id: string;
  date: string;
  shipperId: string;
  thVehiclePlate: string | null;
  areaNote?: string | null;
  pickupLocation?: string | null;
  shipperPickupLocation?: string;
  status: string;
  lines: {
    id: string;
    stallId: string;
    stallCode: string;
    marketCode: string;
    tongTypeId: string;
    quantity: number;
    mcDeliveryMode?: McDeliveryMode | null;
  }[];
}

interface InboundFormProps {
  shippers: ShipperOption[];
  tongTypes: TongTypeOption[];
  markets?: MarketOption[];
  initialSession?: InitialSession;
}

export function InboundForm({
  shippers,
  tongTypes,
  markets = [],
  initialSession,
}: InboundFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(
    initialSession
      ? toDateInputValue(new Date(initialSession.date))
      : toDateInputValue(getDefaultInboundDate())
  );
  const [shipperId, setShipperId] = useState(initialSession?.shipperId ?? "");
  const [thVehiclePlate, setThVehiclePlate] = useState(
    initialSession?.thVehiclePlate ?? ""
  );
  const [areaNote, setAreaNote] = useState(initialSession?.areaNote ?? "");
  const [sessionPickupLocation, setSessionPickupLocation] = useState(() =>
    initialSession?.shipperId
      ? tripPickupSelectValue(
          initialSession.pickupLocation,
          initialSession.shipperPickupLocation
        )
      : ""
  );
  const [vehicleSuggestions, setVehicleSuggestions] = useState<string[]>([]);
  const [rows, setRows] = useState<LineState[]>([]);
  const [removedStallIds, setRemovedStallIds] = useState<string[]>([]);
  const [loadingStalls, setLoadingStalls] = useState(false);
  const [showAddStall, setShowAddStall] = useState(false);
  const [newStall, setNewStall] = useState({
    code: "",
    destination: "",
    marketId: markets[0]?.id ?? "",
    tongTypeId: tongTypes[0]?.id ?? "",
  });
  const [pendingNewStalls, setPendingNewStalls] = useState<
    {
      code: string;
      name?: string;
      marketId: string;
      tongTypeId: string;
      stallId: string;
      rowId: string;
    }[]
  >([]);

  const loadStalls = useCallback(
    async (sid: string) => {
      if (!sid) {
        setRows([]);
        return;
      }
      setLoadingStalls(true);
      try {
        const [stalls, vehicles] = await Promise.all([
          getShipperStalls(sid),
          getThVehiclePlates(sid),
        ]);
        setVehicleSuggestions(vehicles.map((v) => v.plate));

        if (initialSession?.lines.length) {
          const stallIdsWithLines = new Set(
            initialSession.lines.map((l) => l.stallId)
          );
          setRows([
            ...initialSession.lines.map((l) => ({
              rowId: l.id,
              stallId: l.stallId,
              stallCode: l.stallCode,
              marketCode: l.marketCode,
              tongTypeId: l.tongTypeId,
              quantity: String(l.quantity),
              lineId: l.id,
              mcDeliveryMode:
                l.mcDeliveryMode ??
                defaultMcDeliveryMode(l.marketCode),
            })),
            ...stalls
              .filter((s) => !stallIdsWithLines.has(s.stallId))
              .map((s) => ({
                rowId: newRowId(),
                stallId: s.stallId,
                stallCode: s.stallCode,
                marketCode: s.marketCode,
                tongTypeId: s.defaultTongTypeId,
                quantity: "",
                mcDeliveryMode: defaultMcDeliveryMode(s.marketCode),
              })),
          ]);
        } else {
          setRows(
            stalls.map((s) => ({
              rowId: newRowId(),
              stallId: s.stallId,
              stallCode: s.stallCode,
              marketCode: s.marketCode,
              tongTypeId: s.defaultTongTypeId,
              quantity: "",
              mcDeliveryMode: defaultMcDeliveryMode(s.marketCode),
            }))
          );
        }
      } finally {
        setLoadingStalls(false);
      }
    },
    [initialSession]
  );

  useEffect(() => {
    if (shipperId) loadStalls(shipperId);
  }, [shipperId, loadStalls]);

  const marketTotals = useMemo(
    () =>
      computeMarketTotals(
        rows.map((r) => ({
          marketCode: r.marketCode,
          quantity: parseInt(r.quantity, 10) || 0,
        }))
      ),
    [rows]
  );

  const grandTotal = Object.values(marketTotals).reduce((a, b) => a + b, 0);
  const hasMcRows = rows.some((row) => row.marketCode === MC_MARKET_CODE);

  function updateRow(index: number, patch: Partial<LineState>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function duplicateRow(index: number) {
    const source = rows[index];
    if (!source) return;
    setRows((prev) => [
      ...prev.slice(0, index + 1),
      {
        rowId: newRowId(),
        stallId: source.stallId,
        stallCode: source.stallCode,
        marketCode: source.marketCode,
        tongTypeId: source.tongTypeId,
        quantity: "",
        mcDeliveryMode: source.mcDeliveryMode ?? defaultMcDeliveryMode(source.marketCode),
      },
      ...prev.slice(index + 1),
    ]);
  }

  function handleSave(asDraft: boolean) {
    setError(null);
    if (!shipperId) {
      setError("请选择寄货人 Please select a consignor");
      return;
    }

    const lines = rows
      .filter((r) => r.quantity && parseInt(r.quantity, 10) > 0)
      .map((r) => ({
        stallId: r.stallId,
        tongTypeId: r.tongTypeId,
        quantity: parseInt(r.quantity, 10),
        lineId: r.lineId,
        mcDeliveryMode: r.mcDeliveryMode,
      }));

    const shipper = shippers.find((s) => s.id === shipperId);
    const selectedPickup =
      sessionPickupLocation || shipperDefaultPickup(shipper);

    startTransition(async () => {
      try {
        await saveInboundSession({
          date,
          shipperId,
          thVehiclePlate: thVehiclePlate || undefined,
          areaNote: areaNote || undefined,
          pickupLocation: tripPickupSaveValue(
            selectedPickup,
            shipper?.pickupLocation
          ),
          lines,
          removedStallIds,
          newStalls: pendingNewStalls.map((s) => {
            const row = rows.find((r) => r.rowId === s.rowId);
            return {
              code: s.code,
              name: s.name,
              marketId: s.marketId,
              tongTypeId: row?.tongTypeId ?? s.tongTypeId,
              quantity: parseInt(row?.quantity ?? "0", 10) || 0,
            };
          }),
          asDraft,
          sessionId: initialSession?.id,
        });
        router.push("/inbound");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败 Save failed");
      }
    });
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-6">
      {/* Header fields */}
      <div className="grid gap-4 rounded-xl border border-haidee-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            日期 Date
          </label>
          <DateInputField value={date} onChange={setDate} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            寄货人 Consignor
          </label>
          <select
            value={shipperId}
            onChange={(e) => {
              const nextShipperId = e.target.value;
              setShipperId(nextShipperId);
              const shipper = shippers.find((s) => s.id === nextShipperId);
              setSessionPickupLocation(shipperDefaultPickup(shipper));
            }}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30"
          >
            <option value="">— 选择寄货人 Select —</option>
            {shippers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            本趟收货地点 Trip Pickup
          </label>
          <select
            value={sessionPickupLocation}
            onChange={(e) => setSessionPickupLocation(e.target.value)}
            disabled={!shipperId}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:cursor-not-allowed disabled:bg-haidee-surface/60"
          >
            {!shipperId && (
              <option value="">— 选择寄货人 Select —</option>
            )}
            {PICKUP_LOCATIONS.map((code) => (
              <option key={code} value={code}>
                {PICKUP_LOCATION_LABELS[code]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            地区/备注 Area/Note <span className="text-haidee-muted">(选填)</span>
          </label>
          <Input
            value={areaNote}
            onChange={(e) => setAreaNote(e.target.value)}
            placeholder="如 PTN, RN, SK..."
            className="min-h-[44px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            泰国车牌 TH Plate <span className="text-haidee-muted">(选填)</span>
          </label>
          <Input
            list="th-vehicles"
            value={thVehiclePlate}
            onChange={(e) => setThVehiclePlate(e.target.value)}
            placeholder="88-3888"
            className="min-h-[44px] font-mono"
          />
          <datalist id="th-vehicles">
            {vehicleSuggestions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Entry table */}
      {shipperId && (
        <div className="min-w-0 max-w-full rounded-xl border border-haidee-border bg-white">
          {loadingStalls ? (
            <p className="p-8 text-center text-haidee-muted">加载收货人… Loading receivers…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-haidee-muted">
              此寄货人暂无固定收货人，请先在系统设置中添加。
              <br />
              No default receivers for this consignor.
            </p>
          ) : (
            <ScrollMatrixTable heightOffset={340} className="rounded-xl border-0">
              <table className="min-w-max w-full text-sm">
                <thead>
                  <tr className="border-b border-haidee-border bg-haidee-surface text-left text-haidee-muted">
                    <th className={cn(STICKY_HEAD_FIRST, "whitespace-nowrap px-3 py-3 font-medium")}>
                      收货人 Receiver
                    </th>
                    <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 font-medium")}>
                      地区 Area
                    </th>
                    <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 font-medium")}>
                      桶型 Crate Type
                    </th>
                    <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 font-medium text-right")}>
                      桶数 Crates
                    </th>
                    {hasMcRows && (
                      <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 font-medium")}>
                        MC 配送 Delivery
                      </th>
                    )}
                    <th className={cn(STICKY_HEAD_TOP, "w-10 whitespace-nowrap px-2 py-3")}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <InboundLineRow
                      key={row.rowId}
                      stallCode={row.stallCode}
                      marketCode={row.marketCode}
                      tongTypes={tongTypes}
                      tongTypeId={row.tongTypeId}
                      quantity={row.quantity}
                      tabIndex={i + 1}
                      onTongTypeChange={(v) => updateRow(i, { tongTypeId: v })}
                      onQuantityChange={(v) => updateRow(i, { quantity: v })}
                      mcDeliveryMode={row.mcDeliveryMode}
                      onMcDeliveryModeChange={(mode) =>
                        updateRow(i, { mcDeliveryMode: mode })
                      }
                      showMcDelivery={hasMcRows}
                      onDuplicate={() => duplicateRow(i)}
                      onDelete={() => {
                        const sameStallRows = rows.filter(
                          (r) => r.stallId === row.stallId
                        ).length;
                        if (sameStallRows > 1) {
                          if (row.stallId.startsWith("new-")) {
                            setPendingNewStalls((prev) =>
                              prev.filter((s) => s.rowId !== row.rowId)
                            );
                          }
                          setRows((prev) => prev.filter((_, idx) => idx !== i));
                          return;
                        }
                        if (
                          !confirm(
                            `确定要永久删除收货人 ${row.stallCode} 吗？\nAre you sure to permanently delete receiver ${row.stallCode}?`
                          )
                        )
                          return;
                        if (row.stallId.startsWith("new-")) {
                          setPendingNewStalls((prev) =>
                            prev.filter((s) => s.rowId !== row.rowId)
                          );
                        } else {
                          setRemovedStallIds((prev) => [...prev, row.stallId]);
                        }
                        setRows((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </ScrollMatrixTable>
          )}
        </div>
      )}

      {shipperId && (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAddStall((v) => !v)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            新增收货人 Add Receiver
          </Button>
          {showAddStall && (() => {
            const selectedMarket = markets.find((m) => m.id === newStall.marketId);
            const otherSelected = isOtherMarket(selectedMarket?.code);
            return (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4">
              <div className="space-y-1">
                <label className="text-xs text-haidee-muted">地区 Market</label>
                <select
                  value={newStall.marketId}
                  onChange={(e) =>
                    setNewStall({
                      ...newStall,
                      marketId: e.target.value,
                      code: "",
                      destination: "",
                    })
                  }
                  className="min-h-[40px] rounded-lg border border-haidee-border px-3 text-sm"
                >
                  {markets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.displayName ?? m.name}
                    </option>
                  ))}
                </select>
              </div>
              {otherSelected ? (
                <div className="space-y-1">
                  <label className="text-xs text-haidee-muted">
                    目的地 Destination
                  </label>
                  <Input
                    value={newStall.destination}
                    onChange={(e) =>
                      setNewStall({ ...newStall, destination: e.target.value })
                    }
                    placeholder='例如 Hat Yai、Butterworth'
                    className="min-h-[40px]"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs text-haidee-muted">收货人代码 Code</label>
                  <Input
                    value={newStall.code}
                    onChange={(e) =>
                      setNewStall({ ...newStall, code: e.target.value })
                    }
                    className="min-h-[40px] font-mono"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-haidee-muted">桶型 Type</label>
                <select
                  value={newStall.tongTypeId}
                  onChange={(e) =>
                    setNewStall({ ...newStall, tongTypeId: e.target.value })
                  }
                  className="min-h-[40px] rounded-lg border border-haidee-border px-3 text-sm"
                >
                  {tongTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                onClick={() => {
                  const market = markets.find((m) => m.id === newStall.marketId);
                  const other = isOtherMarket(market?.code);
                  const destination = newStall.destination.trim();
                  const code = other
                    ? destination.toUpperCase()
                    : newStall.code.trim();
                  if (!code) return;
                  if (other && !destination) return;
                  const tempId = `new-${crypto.randomUUID()}`;
                  const rowId = newRowId();
                  setPendingNewStalls((prev) => [
                    ...prev,
                    {
                      code,
                      name: other ? destination : undefined,
                      marketId: newStall.marketId,
                      tongTypeId: newStall.tongTypeId,
                      stallId: tempId,
                      rowId,
                    },
                  ]);
                  setRows((prev) => [
                    ...prev,
                    {
                      rowId,
                      stallId: tempId,
                      stallCode: other ? destination : code,
                      marketCode: market?.code ?? "",
                      tongTypeId: newStall.tongTypeId,
                      quantity: "",
                      mcDeliveryMode: defaultMcDeliveryMode(market?.code ?? ""),
                    },
                  ]);
                  setNewStall({
                    code: "",
                    destination: "",
                    marketId: markets[0]?.id ?? "",
                    tongTypeId: tongTypes[0]?.id ?? "",
                  });
                  setShowAddStall(false);
                }}
                className="bg-haidee-blue text-white"
              >
                确认添加 Add
              </Button>
            </div>
            );
          })()}
        </div>
      )}

      {/* Market subtotals */}
      {grandTotal > 0 && (
        <div className="rounded-xl border border-haidee-border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-haidee-text">
            各市场小计 Market Subtotals
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(marketTotals)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([code, qty]) => (
                <div
                  key={code}
                  className="flex items-center gap-2 rounded-lg border border-haidee-border px-3 py-2"
                >
                  <span className="rounded border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700">
                    {code}
                  </span>
                  <span className="font-mono text-lg font-semibold text-haidee-text">
                    {qty}
                  </span>
                  <span className="text-xs text-haidee-muted">桶</span>
                </div>
              ))}
            <div className="flex items-center gap-2 rounded-lg bg-haidee-navy px-4 py-2 text-white">
              <span className="text-sm">合计 Total</span>
              <span className="font-mono text-lg font-bold">{grandTotal}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t border-haidee-border pt-4">
        {initialSession && (
          <InboundDeleteButton sessionId={initialSession.id} />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/inbound")}
          disabled={isPending}
          className="min-h-[44px] min-w-[100px]"
        >
          取消 Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSave(true)}
          disabled={isPending || !shipperId}
          className="min-h-[44px] min-w-[120px]"
        >
          保存草稿 Save Draft
        </Button>
        <Button
          type="button"
          onClick={() => handleSave(false)}
          disabled={isPending || !shipperId}
          className="min-h-[44px] min-w-[120px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          {isPending ? "保存中…" : "确认保存 Confirm"}
        </Button>
      </div>
    </div>
  );
}
