"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { InboundDeleteButton } from "@/components/inbound/InboundDeleteButton";
import { InboundFreightPanel, type InboundFreightLine } from "@/components/inbound/InboundFreightPanel";
import { InboundLineRow } from "@/components/inbound/InboundLineRow";
import { DateInputField } from "@/components/shared/DateInputField";
import { useT } from "@/components/shared/locale-context";
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
  previewInboundFreightLines,
  saveInboundSession,
} from "@/app/actions/inbound";
import { listSubCustomerChannelsForShipper } from "@/app/actions/sub-customer-channels";
import type { SubCustomerChannelOption } from "@/app/actions/sub-customer-channels";
import {
  computeMarketTotals,
  getDefaultInboundDate,
  toDateInputValue,
} from "@/lib/inbound-utils";
import {
  DEFAULT_PICKUP_LOCATION,
  PICKUP_LOCATIONS,
  formatPickupLocationLabel,
  resolveSessionPickupLocation,
  tripPickupSaveValue,
  tripPickupSelectValue,
} from "@/lib/constants/pickup-locations";
import { requiresCustomerOriginSelection } from "@/lib/multi-origin-customer";
import type { InboundFormInitialSession } from "@/lib/inbound-form-serialize";

interface ShipperOption {
  id: string;
  code: string;
  name: string;
  pickupLocation: string;
  defaultTongTypeId: string | null;
}

function shipperDefaultPickup(
  shipper: ShipperOption | undefined
): typeof DEFAULT_PICKUP_LOCATION {
  return resolveSessionPickupLocation(null, shipper?.pickupLocation);
}

function resolveInboundDefaultTongTypeId(
  shipper: ShipperOption | undefined,
  tongTypes: TongTypeOption[]
): string {
  if (shipper?.defaultTongTypeId) return shipper.defaultTongTypeId;
  return tongTypes[0]?.id ?? "";
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

interface InboundFormProps {
  shippers: ShipperOption[];
  tongTypes: TongTypeOption[];
  markets?: MarketOption[];
  initialSession?: InboundFormInitialSession;
  freightLines?: InboundFreightLine[];
}

export function InboundForm({
  shippers,
  tongTypes,
  markets = [],
  initialSession,
  freightLines,
}: InboundFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { t, parts, tLocal, locale } = useT();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(
    initialSession?.date ?? toDateInputValue(getDefaultInboundDate())
  );
  const [shipperId, setShipperId] = useState(initialSession?.shipperId ?? "");
  const [thVehiclePlate, setThVehiclePlate] = useState(
    initialSession?.thVehiclePlate ?? ""
  );
  const [areaNote, setAreaNote] = useState(initialSession?.areaNote ?? "");
  const [customerOriginLocation, setCustomerOriginLocation] = useState(
    initialSession?.customerOriginLocation ?? ""
  );
  const [subChannelKey, setSubChannelKey] = useState(
    initialSession?.subChannelKey ?? ""
  );
  const [subChannels, setSubChannels] = useState<SubCustomerChannelOption[]>(
    []
  );
  const [isMultiOriginCustomer, setIsMultiOriginCustomer] = useState(false);
  const [multiOriginLocations, setMultiOriginLocations] = useState<string[]>([]);
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
    tongTypeId: "",
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
  const showFreightPanel = freightLines !== undefined;
  const [displayFreightLines, setDisplayFreightLines] = useState<
    InboundFreightLine[]
  >(freightLines ?? []);
  const rowsReady =
    !loadingStalls &&
    (rows.length > 0 || !initialSession?.lines.length);

  const selectedShipper = shippers.find((s) => s.id === shipperId);
  const effectivePickup = resolveSessionPickupLocation(
    sessionPickupLocation || shipperDefaultPickup(selectedShipper),
    selectedShipper?.pickupLocation
  );
  const showSubChannelSelect = subChannels.length > 0;
  const selectedSubChannel = subChannels.find(
    (channel) => channel.channelKey === subChannelKey
  );
  const showOriginDropdown =
    showSubChannelSelect && selectedSubChannel
      ? selectedSubChannel.ownerType === "self" &&
        selectedSubChannel.allowMultiOrigin
      : requiresCustomerOriginSelection(
          isMultiOriginCustomer,
          effectivePickup
        );

  useEffect(() => {
    if (!shipperId) {
      setIsMultiOriginCustomer(false);
      setMultiOriginLocations([]);
      setCustomerOriginLocation("");
      setSubChannels([]);
      setSubChannelKey("");
      return;
    }

    let cancelled = false;
    void Promise.all([
      import("@/app/actions/multi-origin-customer").then((m) =>
        m.getMultiOriginConfig(shipperId)
      ),
      listSubCustomerChannelsForShipper(shipperId),
    ]).then(([config, channels]) => {
      if (cancelled) return;
      setIsMultiOriginCustomer(config.isMultiOrigin);
      setMultiOriginLocations(config.locations);
      setSubChannels(channels);
      if (channels.length > 0) {
        setSubChannelKey((current) => {
          if (current && channels.some((c) => c.channelKey === current)) {
            return current;
          }
          return channels[0]?.channelKey ?? "";
        });
      } else {
        setSubChannelKey("");
        if (!config.isMultiOrigin) {
          setCustomerOriginLocation("");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shipperId]);

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
            }))
          );
        }
      } catch (e) {
        setRows([]);
        setError(e instanceof Error ? e.message : t("error.loadReceiversFailed"));
      } finally {
        setLoadingStalls(false);
      }
    },
    [initialSession, t]
  );

  useEffect(() => {
    if (shipperId) loadStalls(shipperId);
  }, [shipperId, loadStalls]);

  useEffect(() => {
    if (!shipperId) return;
    const shipper = shippers.find((s) => s.id === shipperId);
    setNewStall((prev) => ({
      ...prev,
      tongTypeId: resolveInboundDefaultTongTypeId(shipper, tongTypes),
    }));
  }, [shipperId, shippers, tongTypes]);

  useEffect(() => {
    if (freightLines) {
      setDisplayFreightLines(freightLines);
    }
  }, [freightLines]);

  useEffect(() => {
    if (!showFreightPanel || !shipperId || !rowsReady || isPending) return;

    const activeLines = rows
      .filter((row) => !row.stallId.startsWith("new-"))
      .map((row) => ({
        stallId: row.stallId,
        tongTypeId: row.tongTypeId,
        quantity: parseInt(row.quantity, 10) || 0,
        lineId: row.lineId,
        stallCode: row.stallCode,
        marketCode: row.marketCode,
      }))
      .filter((line) => line.quantity > 0);

    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (activeLines.length === 0) {
            if (!cancelled) setDisplayFreightLines([]);
            return;
          }

          const shipper = shippers.find((s) => s.id === shipperId);
          const selectedPickup =
            sessionPickupLocation || shipperDefaultPickup(shipper);

          const preview = await previewInboundFreightLines({
            date,
            shipperId,
            pickupLocation: tripPickupSaveValue(
              selectedPickup,
              shipper?.pickupLocation,
              locale
            ),
            areaNote: areaNote || undefined,
            lines: activeLines,
          });

          if (!cancelled) {
            setDisplayFreightLines(preview);
          }
        } catch {
          // Keep the last preview; avoid surfacing transient calc errors in the form.
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    showFreightPanel,
    shipperId,
    rowsReady,
    isPending,
    loadingStalls,
    date,
    sessionPickupLocation,
    areaNote,
    rows,
    shippers,
    locale,
  ]);

  const mergedFreightLines = useMemo(() => {
    if (!displayFreightLines.length) return displayFreightLines;

    const tongCodeById = new Map(tongTypes.map((tongType) => [tongType.id, tongType.code]));
    const rowByLineId = new Map(
      rows.filter((row) => row.lineId).map((row) => [row.lineId!, row])
    );

    return displayFreightLines.map((line) => {
      const row = rowByLineId.get(line.id);
      if (!row) return line;

      return {
        ...line,
        tongTypeCode: tongCodeById.get(row.tongTypeId) ?? line.tongTypeCode,
        quantity: parseInt(row.quantity, 10) || 0,
      };
    });
  }, [displayFreightLines, rows, tongTypes]);

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
      },
      ...prev.slice(index + 1),
    ]);
  }

  function handleSave(asDraft: boolean) {
    setError(null);
    if (!shipperId) {
      setError(t("error.selectConsignor"));
      return;
    }
    if (showSubChannelSelect && !subChannelKey) {
      setError("请选择子顾客渠道 Please select a sub-customer channel");
      return;
    }
    if (showOriginDropdown && !customerOriginLocation) {
      setError(t("multiOrigin.error.required"));
      return;
    }

    const lines = rows
      .filter((r) => r.quantity && parseInt(r.quantity, 10) > 0)
      .map((r) => ({
        stallId: r.stallId,
        tongTypeId: r.tongTypeId,
        quantity: parseInt(r.quantity, 10),
        lineId: r.lineId,
      }));

    const shipper = shippers.find((s) => s.id === shipperId);
    const selectedPickup =
      sessionPickupLocation || shipperDefaultPickup(shipper);

    startTransition(async () => {
      try {
        const result = await saveInboundSession({
          date,
          shipperId,
          thVehiclePlate: thVehiclePlate || undefined,
          areaNote: areaNote || undefined,
          customerOriginLocation: showOriginDropdown
            ? customerOriginLocation
            : undefined,
          subChannelKey: showSubChannelSelect ? subChannelKey : undefined,
          pickupLocation: tripPickupSaveValue(
            selectedPickup,
            shipper?.pickupLocation,
            locale
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
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.replace("/inbound");
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error.saveFailed"));
      }
    });
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-6">
      {/* Header fields */}
      <div className="grid gap-4 rounded-xl border border-haidee-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            {t("common.date")}
          </label>
          <DateInputField value={date} onChange={setDate} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            {t("common.consignor")}
          </label>
          <select
            value={shipperId}
            onChange={(e) => {
              const nextShipperId = e.target.value;
              setShipperId(nextShipperId);
              const shipper = shippers.find((s) => s.id === nextShipperId);
              setSessionPickupLocation(shipperDefaultPickup(shipper));
              setCustomerOriginLocation("");
            }}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30"
          >
            <option value="">{t("inbound.selectConsignor")}</option>
            {shippers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {showSubChannelSelect ? (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-haidee-text">
              子顾客渠道 Sub-customer channel{" "}
              <span className="text-red-600">*</span>
            </label>
            <select
              value={subChannelKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                setSubChannelKey(nextKey);
                const nextChannel = subChannels.find(
                  (c) => c.channelKey === nextKey
                );
                if (
                  !nextChannel ||
                  nextChannel.ownerType !== "self" ||
                  !nextChannel.allowMultiOrigin
                ) {
                  setCustomerOriginLocation("");
                }
              }}
              className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30"
            >
              <option value="">选择子顾客…</option>
              {subChannels.map((channel) => (
                <option key={channel.channelKey} value={channel.channelKey}>
                  {channel.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            {t("inbound.tripPickup")}
          </label>
          <select
            value={sessionPickupLocation}
            onChange={(e) => setSessionPickupLocation(e.target.value)}
            disabled={!shipperId}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30 disabled:cursor-not-allowed disabled:bg-haidee-surface/60"
          >
            {!shipperId && (
              <option value="">{t("inbound.selectConsignor")}</option>
            )}
            {PICKUP_LOCATIONS.map((code) => (
              <option key={code} value={code}>
                {formatPickupLocationLabel(code, locale)}
              </option>
            ))}
          </select>
        </div>

        {showOriginDropdown ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              {t("multiOrigin.standardOrigin")}{" "}
              <span className="text-red-600">*</span>
            </label>
            <select
              value={customerOriginLocation}
              onChange={(e) => setCustomerOriginLocation(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm focus:border-haidee-accent focus:outline-none focus:ring-2 focus:ring-haidee-accent/30"
            >
              <option value="">{t("multiOrigin.selectOrigin")}</option>
              {multiOriginLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            {t("inbound.areaNote")}{" "}
            <span className="text-haidee-muted">
              ({parts("common.optional").local})
            </span>
          </label>
          <Input
            value={areaNote}
            onChange={(e) => setAreaNote(e.target.value)}
            placeholder={t("inbound.areaNotePlaceholder")}
            className="min-h-[44px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            {t("inbound.thPlateField")}{" "}
            <span className="text-haidee-muted">
              ({parts("common.optional").local})
            </span>
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
            <p className="p-8 text-center text-haidee-muted">
              {t("inbound.loadingReceivers")}
            </p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-haidee-muted">
              {t("inbound.noDefaultReceivers")}
            </p>
          ) : (
            <ScrollMatrixTable heightOffset={340} className="rounded-xl border-0">
              <table className="min-w-max w-full text-sm">
                <thead>
                  <tr className="border-b border-haidee-border bg-haidee-surface text-left text-haidee-muted">
                    <th className={cn(STICKY_HEAD_FIRST, "whitespace-nowrap px-3 py-3 font-medium")}>
                      {t("common.receiver")}
                    </th>
                    <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 font-medium")}>
                      {t("common.area")}
                    </th>
                    <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 font-medium")}>
                      {t("common.crateType")}
                    </th>
                    <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 font-medium text-right")}>
                      {t("common.crateCount")}
                    </th>
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
                            tLocal("inbound.deleteReceiverConfirm", {
                              code: row.stallCode,
                            })
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
            {t("inbound.addReceiver")}
          </Button>
          {showAddStall && (() => {
            const selectedMarket = markets.find((m) => m.id === newStall.marketId);
            const otherSelected = isOtherMarket(selectedMarket?.code);
            return (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4">
              <div className="space-y-1">
                <label className="text-xs text-haidee-muted">
                  {t("inbound.marketField")}
                </label>
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
                    {t("common.destination")}
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
                  <label className="text-xs text-haidee-muted">
                    {t("inbound.receiverCode")}
                  </label>
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
                <label className="text-xs text-haidee-muted">
                  {t("common.crateType")}
                </label>
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
                    },
                  ]);
                  setNewStall({
                    code: "",
                    destination: "",
                    marketId: markets[0]?.id ?? "",
                    tongTypeId: resolveInboundDefaultTongTypeId(
                      shippers.find((s) => s.id === shipperId),
                      tongTypes
                    ),
                  });
                  setShowAddStall(false);
                }}
                className="bg-haidee-blue text-white"
              >
                {t("inbound.confirmAdd")}
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
            {t("inbound.marketSubtotals")}
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
                  <span className="text-xs text-haidee-muted">
                    {parts("common.crateUnit").local}
                  </span>
                </div>
              ))}
            <div className="flex items-center gap-2 rounded-lg bg-haidee-navy px-4 py-2 text-white">
              <span className="text-sm">{t("common.total")}</span>
              <span className="font-mono text-lg font-bold">{grandTotal}</span>
            </div>
          </div>
        </div>
      )}

      {showFreightPanel && mergedFreightLines.length > 0 && (
        <InboundFreightPanel lines={mergedFreightLines} />
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
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSave(true)}
          disabled={isPending || !shipperId}
          className="min-h-[44px] min-w-[120px]"
        >
          {t("inbound.saveDraft")}
        </Button>
        <Button
          type="button"
          onClick={() => handleSave(false)}
          disabled={isPending || !shipperId}
          className="min-h-[44px] min-w-[120px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          {isPending ? t("common.saving") : t("inbound.confirmSave")}
        </Button>
      </div>
    </div>
  );
}
