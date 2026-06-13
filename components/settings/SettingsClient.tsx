"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatPickupLocationLabel,
  PICKUP_LOCATIONS,
  PICKUP_LOCATION_LABELS,
} from "@/lib/constants/pickup-locations";
import { Badge } from "@/components/ui/badge";
import {
  saveShipper,
  deleteShipper,
  saveStall,
  deleteStall,
  saveShipperStallDefault,
  deleteShipperStallDefault,
  saveTruck,
  deleteTruck,
  saveUser,
  deleteUser,
} from "@/app/actions/settings";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { stickyFirstColTableClass } from "@/lib/table-scroll";
import type { FreightSettingsData } from "@/components/settings/FreightRatesSection";
import { FreightRatesSection } from "@/components/settings/FreightRatesSection";
import { ExchangeRateSection } from "@/components/settings/ExchangeRateSection";

interface MarketOption {
  id: string;
  code: string;
  name: string;
}

interface TongTypeOption {
  id: string;
  code: string;
  name: string;
}

interface SettingsData {
  shippers: {
    id: string;
    code: string;
    name: string;
    nameTh: string | null;
    phone: string | null;
    defaultTongTypeId: string | null;
    defaultTongTypeCode: string;
    paymentParty: string;
    company: string;
    currency: string;
    pickupLocation: string;
    active: boolean;
  }[];
  stalls: {
    id: string;
    code: string;
    name: string | null;
    marketId: string | null;
    marketCode: string;
    active: boolean;
  }[];
  defaults: {
    id: string;
    shipperId: string;
    shipperName: string;
    stallId: string;
    stallCode: string;
    marketCode: string;
    tongTypeId: string;
    tongTypeCode: string;
  }[];
  trucks: {
    id: string;
    plate: string;
    type: string;
    capacityTong: number | null;
    defaultDriverId: string | null;
    defaultDriverName: string;
    sortOrder: number | null;
    active: boolean;
  }[];
  drivers: {
    id: string;
    name: string;
  }[];
  users: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    active: boolean;
  }[];
  markets: MarketOption[];
  tongTypes: TongTypeOption[];
}

interface SettingsClientProps {
  data: SettingsData;
  freightData: FreightSettingsData & {
    exchangeRates: { id: string; yearMonth: string; rate: number }[];
    exchangeAlert: {
      currentYearMonth: string;
      missing: boolean;
      currentRate: number | null;
    };
  };
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "default" : "secondary"}>
      {active ? "启用 Active" : "停用 Inactive"}
    </Badge>
  );
}

function ShipperCurrencyBadge({ currency }: { currency: string }) {
  const isMyr = currency === "MYR";
  return (
    <span
      className={
        isMyr
          ? "inline-flex rounded border border-haidee-blue/40 bg-haidee-blue/10 px-2 py-0.5 text-xs font-medium text-haidee-blue"
          : "inline-flex rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
      }
    >
      {currency}
    </span>
  );
}

export function SettingsClient({ data, freightData }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | undefined>();

  // Form states
  const [shipperForm, setShipperForm] = useState({
    code: "",
    name: "",
    nameTh: "",
    phone: "",
    defaultTongTypeId: "",
    paymentParty: "shipper",
    company: "haidee",
    currency: "THB",
    pickupLocation: "SADAO",
    active: true,
  });
  const [stallForm, setStallForm] = useState({
    code: "",
    name: "",
    marketId: "",
    active: true,
  });
  const [defaultForm, setDefaultForm] = useState({
    shipperId: "",
    stallId: "",
    tongTypeId: "",
  });
  const [truckForm, setTruckForm] = useState({
    plate: "",
    type: "big",
    capacityTong: "",
    defaultDriverId: "",
    sortOrder: "",
    active: true,
  });
  const [userForm, setUserForm] = useState({
    email: "",
    name: "",
    role: "clerk",
    active: true,
    password: "",
  });

  function refresh() {
    router.refresh();
  }

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setDialog(null);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="w-full space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="w-full overflow-hidden rounded-xl border border-haidee-border bg-white">
      <Tabs defaultValue="shippers" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-haidee-border bg-haidee-surface p-2">
          <TabsTrigger value="shippers" className="min-h-[40px] px-3">
            寄货人 Shippers
          </TabsTrigger>
          <TabsTrigger value="stalls" className="min-h-[40px] px-3">
            档口 Stalls
          </TabsTrigger>
          <TabsTrigger value="defaults" className="min-h-[40px] px-3">
            档口对应 Defaults
          </TabsTrigger>
          <TabsTrigger value="trucks" className="min-h-[40px] px-3">
            车辆 Trucks
          </TabsTrigger>
          <TabsTrigger value="users" className="min-h-[40px] px-3">
            用户 Users
          </TabsTrigger>
          <TabsTrigger value="freight-rates" className="min-h-[40px] px-3">
            车力费率 Freight Rates
          </TabsTrigger>
          <TabsTrigger value="exchange-rate" className="min-h-[40px] px-3">
            汇率 Exchange Rate
          </TabsTrigger>
        </TabsList>

        {/* Shippers */}
        <TabsContent value="shippers" className="w-full p-4">
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setShipperForm({
                  code: "",
                  name: "",
                  nameTh: "",
                  phone: "",
                  defaultTongTypeId: data.tongTypes[0]?.id ?? "",
                  paymentParty: "shipper",
                  company: "haidee",
                  currency: "THB",
                  pickupLocation: "SADAO",
                  active: true,
                });
                setDialog("shipper");
              }}
              className="gap-2 bg-haidee-blue text-white"
            >
              <Plus className="h-4 w-4" /> 新增寄货人
            </Button>
          </div>
          <DataTable>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>代码 Code</TableHead>
                <TableHead>名称 Name</TableHead>
                <TableHead>货币 Currency</TableHead>
                <TableHead>默认桶型 Default Crate Type</TableHead>
                <TableHead>付款方 Payment</TableHead>
                <TableHead>收货地点 Pickup</TableHead>
                <TableHead>公司 Company</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.shippers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    <ShipperCurrencyBadge currency={s.currency} />
                  </TableCell>
                  <TableCell className="font-mono">{s.defaultTongTypeCode || "—"}</TableCell>
                  <TableCell>{s.paymentParty}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatPickupLocationLabel(s.pickupLocation)}
                  </TableCell>
                  <TableCell>{s.company}</TableCell>
                  <TableCell><ActiveBadge active={s.active} /></TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(s.id);
                        setShipperForm({
                          code: s.code,
                          name: s.name,
                          nameTh: s.nameTh ?? "",
                          phone: s.phone ?? "",
                          defaultTongTypeId: s.defaultTongTypeId ?? "",
                          paymentParty: s.paymentParty,
                          company: s.company,
                          currency: s.currency,
                          pickupLocation: s.pickupLocation,
                          active: s.active,
                        });
                        setDialog("shipper");
                      }}
                      onDelete={() =>
                        runAction(async () => deleteShipper(s.id))
                      }
                      disabled={isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TabsContent>

        {/* Stalls */}
        <TabsContent value="stalls" className="w-full p-4">
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setStallForm({
                  code: "",
                  name: "",
                  marketId: data.markets[0]?.id ?? "",
                  active: true,
                });
                setDialog("stall");
              }}
              className="gap-2 bg-haidee-blue text-white"
            >
              <Plus className="h-4 w-4" /> 新增档口
            </Button>
          </div>
          <DataTable>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>代码 Code</TableHead>
                <TableHead>名称 Name</TableHead>
                <TableHead>市场 Market</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stalls.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.code}</TableCell>
                  <TableCell>{s.name ?? "—"}</TableCell>
                  <TableCell className="font-mono">{s.marketCode || "—"}</TableCell>
                  <TableCell><ActiveBadge active={s.active} /></TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(s.id);
                        setStallForm({
                          code: s.code,
                          name: s.name ?? "",
                          marketId: s.marketId ?? "",
                          active: s.active,
                        });
                        setDialog("stall");
                      }}
                      onDelete={() => runAction(async () => deleteStall(s.id))}
                      disabled={isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TabsContent>

        {/* Defaults */}
        <TabsContent value="defaults" className="w-full p-4">
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setDefaultForm({
                  shipperId: data.shippers[0]?.id ?? "",
                  stallId: data.stalls[0]?.id ?? "",
                  tongTypeId: data.tongTypes[0]?.id ?? "",
                });
                setDialog("default");
              }}
              className="gap-2 bg-haidee-blue text-white"
            >
              <Plus className="h-4 w-4" /> 新增对应
            </Button>
          </div>
          <DataTable>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>寄货人 Consignor</TableHead>
                <TableHead>市场 Market</TableHead>
                <TableHead>档口 Stall</TableHead>
                <TableHead>默认桶型 Default Crate Type</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.defaults.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.shipperName}</TableCell>
                  <TableCell className="font-mono">{d.marketCode}</TableCell>
                  <TableCell className="font-mono">{d.stallCode}</TableCell>
                  <TableCell className="font-mono">{d.tongTypeCode}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(d.id);
                        setDefaultForm({
                          shipperId: d.shipperId,
                          stallId: d.stallId,
                          tongTypeId: d.tongTypeId,
                        });
                        setDialog("default");
                      }}
                      onDelete={() =>
                        runAction(async () => deleteShipperStallDefault(d.id))
                      }
                      disabled={isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TabsContent>

        {/* Trucks */}
        <TabsContent value="trucks" className="w-full p-4">
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setTruckForm({
                  plate: "",
                  type: "big",
                  capacityTong: "",
                  defaultDriverId: "",
                  sortOrder: "",
                  active: true,
                });
                setDialog("truck");
              }}
              className="gap-2 bg-haidee-blue text-white"
            >
              <Plus className="h-4 w-4" /> 新增车辆
            </Button>
          </div>
          <DataTable>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>车牌 Plate</TableHead>
                <TableHead>默认司机 Default Driver</TableHead>
                <TableHead>类型 Type</TableHead>
                <TableHead className="text-right">容量 Capacity</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trucks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono font-semibold">{t.plate}</TableCell>
                  <TableCell>{t.defaultDriverName || "—"}</TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell className="text-right font-mono">
                    {t.capacityTong ?? "—"}
                  </TableCell>
                  <TableCell><ActiveBadge active={t.active} /></TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(t.id);
                        setTruckForm({
                          plate: t.plate,
                          type: t.type,
                          capacityTong: t.capacityTong?.toString() ?? "",
                          defaultDriverId: t.defaultDriverId ?? "",
                          sortOrder: t.sortOrder?.toString() ?? "",
                          active: t.active,
                        });
                        setDialog("truck");
                      }}
                      onDelete={() => runAction(async () => deleteTruck(t.id))}
                      disabled={isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="w-full p-4">
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setUserForm({
                  email: "",
                  name: "",
                  role: "clerk",
                  active: true,
                  password: "",
                });
                setDialog("user");
              }}
              className="gap-2 bg-haidee-blue text-white"
            >
              <Plus className="h-4 w-4" /> 新增用户
            </Button>
          </div>
          <DataTable>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>邮箱 Email</TableHead>
                <TableHead>名称 Name</TableHead>
                <TableHead>角色 Role</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell><ActiveBadge active={u.active} /></TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(u.id);
                        setUserForm({
                          email: u.email,
                          name: u.name ?? "",
                          role: u.role,
                          active: u.active,
                          password: "",
                        });
                        setDialog("user");
                      }}
                      onDelete={() => runAction(async () => deleteUser(u.id))}
                      disabled={isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TabsContent>

        <TabsContent value="freight-rates" className="w-full p-4">
          <FreightRatesSection data={freightData} />
        </TabsContent>

        <TabsContent value="exchange-rate" className="w-full p-4">
          {freightData.exchangeAlert.missing && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              提醒：{freightData.exchangeAlert.currentYearMonth} 当月汇率尚未设定。
            </div>
          )}
          <ExchangeRateSection
            exchangeRates={freightData.exchangeRates}
            exchangeAlert={freightData.exchangeAlert}
          />
        </TabsContent>
      </Tabs>
      </div>

      {/* Shipper Dialog */}
      <FormDialog
        open={dialog === "shipper"}
        onClose={() => setDialog(null)}
        title={editId ? "编辑寄货人 Edit Shipper" : "新增寄货人 New Shipper"}
        onSave={() =>
          runAction(async () =>
            saveShipper({ id: editId, ...shipperForm })
          )
        }
        isPending={isPending}
      >
        <FormField label="代码 Code">
          <Input value={shipperForm.code} onChange={(e) => setShipperForm({ ...shipperForm, code: e.target.value })} className="min-h-[44px]" />
        </FormField>
        <FormField label="名称 Name">
          <Input value={shipperForm.name} onChange={(e) => setShipperForm({ ...shipperForm, name: e.target.value })} className="min-h-[44px]" />
        </FormField>
        <FormField label="泰文名 Name (TH)">
          <Input value={shipperForm.nameTh} onChange={(e) => setShipperForm({ ...shipperForm, nameTh: e.target.value })} className="min-h-[44px]" />
        </FormField>
        <FormField label="电话 Phone">
          <Input value={shipperForm.phone} onChange={(e) => setShipperForm({ ...shipperForm, phone: e.target.value })} className="min-h-[44px]" />
        </FormField>
        <FormField label="默认桶型 Default Crate Type">
          <select
            value={shipperForm.defaultTongTypeId}
            onChange={(e) => setShipperForm({ ...shipperForm, defaultTongTypeId: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="">—</option>
            {data.tongTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="付款方 Payment Party">
          <select
            value={shipperForm.paymentParty}
            onChange={(e) => setShipperForm({ ...shipperForm, paymentParty: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="shipper">寄货人付 Shipper</option>
            <option value="consignee">收货人付 Consignee</option>
          </select>
        </FormField>
        <FormField label="公司 Company">
          <select
            value={shipperForm.company}
            onChange={(e) => setShipperForm({ ...shipperForm, company: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="haidee">HAI DEE</option>
            <option value="wtl">WTL</option>
          </select>
        </FormField>
        <FormField label="收货地点 Pickup Location">
          <select
            value={shipperForm.pickupLocation}
            onChange={(e) =>
              setShipperForm({ ...shipperForm, pickupLocation: e.target.value })
            }
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            {PICKUP_LOCATIONS.map((code) => (
              <option key={code} value={code}>
                {PICKUP_LOCATION_LABELS[code]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="货币 Currency">
          <select
            value={shipperForm.currency}
            onChange={(e) => setShipperForm({ ...shipperForm, currency: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="THB">THB 泰铢</option>
            <option value="MYR">MYR 马币</option>
          </select>
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shipperForm.active}
            onChange={(e) => setShipperForm({ ...shipperForm, active: e.target.checked })}
          />
          启用 Active
        </label>
      </FormDialog>

      {/* Stall Dialog */}
      <FormDialog
        open={dialog === "stall"}
        onClose={() => setDialog(null)}
        title={editId ? "编辑档口 Edit Stall" : "新增档口 New Stall"}
        onSave={() => runAction(async () => saveStall({ id: editId, ...stallForm }))}
        isPending={isPending}
      >
        <FormField label="代码 Code">
          <Input value={stallForm.code} onChange={(e) => setStallForm({ ...stallForm, code: e.target.value })} className="min-h-[44px]" />
        </FormField>
        <FormField label="名称 Name">
          <Input value={stallForm.name} onChange={(e) => setStallForm({ ...stallForm, name: e.target.value })} className="min-h-[44px]" />
        </FormField>
        <FormField label="市场 Market">
          <select
            value={stallForm.marketId}
            onChange={(e) => setStallForm({ ...stallForm, marketId: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="">—</option>
            {data.markets.map((m) => (
              <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
            ))}
          </select>
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={stallForm.active} onChange={(e) => setStallForm({ ...stallForm, active: e.target.checked })} />
          启用 Active
        </label>
      </FormDialog>

      {/* Default Dialog */}
      <FormDialog
        open={dialog === "default"}
        onClose={() => setDialog(null)}
        title={editId ? "编辑对应 Edit Default" : "新增对应 New Default"}
        onSave={() => runAction(async () => saveShipperStallDefault({ id: editId, ...defaultForm }))}
        isPending={isPending}
      >
        <FormField label="寄货人 Consignor">
          <select
            value={defaultForm.shipperId}
            onChange={(e) => setDefaultForm({ ...defaultForm, shipperId: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            {data.shippers.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="档口 Stall">
          <select
            value={defaultForm.stallId}
            onChange={(e) => setDefaultForm({ ...defaultForm, stallId: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            {data.stalls.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>
                {s.marketCode}/{s.code}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="默认桶型 Default Crate Type">
          <select
            value={defaultForm.tongTypeId}
            onChange={(e) => setDefaultForm({ ...defaultForm, tongTypeId: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            {data.tongTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
            ))}
          </select>
        </FormField>
      </FormDialog>

      {/* Truck Dialog */}
      <FormDialog
        open={dialog === "truck"}
        onClose={() => setDialog(null)}
        title={editId ? "编辑车辆 Edit Truck" : "新增车辆 New Truck"}
        onSave={() =>
          runAction(async () =>
            saveTruck({
              id: editId,
              plate: truckForm.plate,
              type: truckForm.type,
              capacityTong: truckForm.capacityTong
                ? parseInt(truckForm.capacityTong, 10)
                : undefined,
              defaultDriverId: truckForm.defaultDriverId || null,
              sortOrder: truckForm.sortOrder
                ? parseInt(truckForm.sortOrder, 10)
                : null,
              active: truckForm.active,
            })
          )
        }
        isPending={isPending}
      >
        <FormField label="车牌 Plate">
          <Input value={truckForm.plate} onChange={(e) => setTruckForm({ ...truckForm, plate: e.target.value })} className="min-h-[44px] font-mono" />
        </FormField>
        <FormField label="类型 Type">
          <select
            value={truckForm.type}
            onChange={(e) => setTruckForm({ ...truckForm, type: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="big">大车 Big</option>
            <option value="small">小车 Small</option>
          </select>
        </FormField>
        <FormField label="容量 Capacity (crates)">
          <Input
            type="number"
            inputMode="numeric"
            value={truckForm.capacityTong}
            onChange={(e) => setTruckForm({ ...truckForm, capacityTong: e.target.value })}
            className="min-h-[44px] font-mono"
          />
        </FormField>
        <FormField label="默认司机 Default Driver">
          <select
            value={truckForm.defaultDriverId}
            onChange={(e) =>
              setTruckForm({ ...truckForm, defaultDriverId: e.target.value })
            }
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="">— 无 None —</option>
            {data.drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="排序 Sort Order">
          <Input
            type="number"
            inputMode="numeric"
            value={truckForm.sortOrder}
            onChange={(e) => setTruckForm({ ...truckForm, sortOrder: e.target.value })}
            className="min-h-[44px] font-mono"
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={truckForm.active} onChange={(e) => setTruckForm({ ...truckForm, active: e.target.checked })} />
          启用 Active
        </label>
      </FormDialog>

      {/* User Dialog */}
      <FormDialog
        open={dialog === "user"}
        onClose={() => setDialog(null)}
        title={editId ? "编辑用户 Edit User" : "新增用户 New User"}
        onSave={() =>
          runAction(async () =>
            saveUser({
              id: editId,
              email: userForm.email,
              name: userForm.name,
              role: userForm.role,
              active: userForm.active,
              password: userForm.password || undefined,
            })
          )
        }
        isPending={isPending}
      >
        <FormField label="邮箱 Email">
          <Input
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            disabled={!!editId}
            className="min-h-[44px]"
          />
        </FormField>
        <FormField label="名称 Name">
          <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="min-h-[44px]" />
        </FormField>
        <FormField label="角色 Role">
          <select
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="clerk">文员 Clerk</option>
            <option value="admin">管理员 Admin</option>
          </select>
        </FormField>
        <FormField label={editId ? "新密码 New Password (留空不改)" : "密码 Password"}>
          <Input
            type="password"
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            className="min-h-[44px]"
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={userForm.active} onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })} />
          启用 Active
        </label>
      </FormDialog>
    </div>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <ScrollMatrixTable heightOffset={320} className="rounded-lg">
      <Table noScrollContainer className={stickyFirstColTableClass}>
        {children}
      </Table>
    </ScrollMatrixTable>
  );
}

function RowActions({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={onEdit} disabled={disabled}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={disabled}
        className="text-haidee-red hover:text-haidee-red"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-haidee-text">{label}</label>
      {children}
    </div>
  );
}

function FormDialog({
  open,
  onClose,
  title,
  onSave,
  isPending,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSave: () => void;
  isPending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">{children}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            取消 Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isPending}
            className="bg-haidee-blue text-white"
          >
            {isPending ? "保存中…" : "保存 Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
