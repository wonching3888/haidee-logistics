"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { OperationsSettingsSection } from "@/components/settings/OperationsSettingsSection";
import { DriverPayrollSettingsSection } from "@/components/settings/DriverPayrollSettingsSection";
import { RouteMasterSettingsSection } from "@/components/settings/RouteMasterSettingsSection";
import { PayrollSettingsSection } from "@/components/settings/AllowanceSettingsSection";
import { CrateRentalRatesSection } from "@/components/settings/CrateRentalRatesSection";
import { UnloadingRatesSettings } from "@/components/driver-expenses/UnloadingRatesSettings";
import type { GlobalCostSettingRow } from "@/lib/global-cost-settings-service";
import type { RouteMasterRow } from "@/components/settings/RouteFormDialog";
import {
  TruckFormDialog,
  type TruckFormValue,
} from "@/components/settings/TruckFormDialog";
import {
  fuelPriceForCountry,
  getTruckCountryMeta,
  type TruckCountry,
} from "@/lib/constants/truck-cost";
import { calcGrandTotalPerKm, calcFuelCostPerKm } from "@/lib/truck-cost";
import { getRoleLabel, isLegacyUserRole } from "@/lib/auth-roles";
import type { StoredUserRole } from "@/types";
import {
  SETTINGS_SECTION_TITLES,
  type SettingsSection,
} from "@/lib/constants/settings-nav";
import { SHIPPER_INVOICE_COMPANIES } from "@/lib/constants/shipper-invoice-company";

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
    invoiceCompany: string;
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
    consigneeId: string | null;
    consigneeCode: string;
    consigneeName: string;
    active: boolean;
  }[];
  defaults: {
    id: string;
    shipperId: string;
    shipperName: string;
    stallId: string;
    stallCode: string;
    marketCode: string;
  }[];
  trucks: {
    id: string;
    plate: string;
    type: string;
    country: TruckCountry;
    tollClass: "class2" | "class3";
    capacityTong: number | null;
    defaultDriverId: string | null;
    defaultDriverName: string;
    sortOrder: number | null;
    fuelEfficiencyKmPerL: number | null;
    annualMileageKm: number | null;
    costItems: {
      id: string;
      name: string;
      annualAmount: number;
      sortOrder: number;
    }[];
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
  activeSection: SettingsSection;
  data: SettingsData;
  freightData: FreightSettingsData & {
    exchangeRates: { id: string; yearMonth: string; rate: number }[];
    exchangeAlert: {
      currentYearMonth: string;
      missing: boolean;
      currentRate: number | null;
    };
    fuelPrice: {
      myrPerLiter: number;
      thbPerLiter: number;
    };
    operationalSettings: {
      mcThirdPartyRateTong: number | null;
      mcThirdPartyRateBox: number | null;
      driverAllowancePerCrate: number | null;
    };
    thaiSegmentRates: {
      songkhlaRateTong: number;
      songkhlaRateBox: number;
      pattaniRateTong: number;
      pattaniRateBox: number;
    };
    globalCosts: GlobalCostSettingRow[];
    marketOperationalRates: {
      marketId: string;
      code: string;
      name: string;
      tollFee: number | null;
      loadUnloadPerCrate: number | null;
      crateRentalPerCrate: number | null;
    }[];
  };
  driverPayrollDrivers: {
    id: string;
    name: string;
    fullName: string | null;
    active: boolean;
    baseSalary: number | null;
    autoCountEmployeeCode: string | null;
    icNumber: string | null;
    epfNumber: string | null;
    socsoNumber: string | null;
    maritalStatus: string | null;
    childCount: number;
    accountCodeSuffix: string | null;
  }[];
  routeMasters: RouteMasterRow[];
  payrollSettings: {
    routes: {
      id: string;
      code: string;
      name: string;
      markets: string[];
      driverAllowance: number | null;
    }[];
    extraMarketAllowance: number;
    bigTruckCrateCommission: number | null;
    smallTruckCrateCommission: number | null;
    bpCrateCommissionBigTruck: number | null;
    bpCrateCommissionSmallTruck: number | null;
    crateReturnMultiMarketAllowance: number;
  } | null;
  crateRentalRates: {
    id: string;
    crateType: string;
    isRental: boolean;
    rate: number;
    currency: "MYR" | "THB";
    notes: string | null;
  }[];
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

export function SettingsClient({
  activeSection,
  data,
  freightData,
  driverPayrollDrivers,
  routeMasters,
  payrollSettings,
  crateRentalRates,
}: SettingsClientProps) {
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
    invoiceCompany: "haidee",
    currency: "THB",
    pickupLocation: "SADAO",
    active: true,
  });
  const [stallForm, setStallForm] = useState({
    code: "",
    name: "",
    marketId: "",
    consigneeId: "",
    active: true,
  });
  const [defaultForm, setDefaultForm] = useState({
    shipperId: "",
    stallId: "",
  });
  const [truckInitialValue, setTruckInitialValue] = useState<
    TruckFormValue | undefined
  >(undefined);
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

  const sectionTitle = SETTINGS_SECTION_TITLES[activeSection];

  return (
    <div className="w-full space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="min-h-[560px] w-full min-w-0 overflow-x-auto overflow-y-visible rounded-xl border border-haidee-border bg-white">
        <div className="border-b border-haidee-border px-4 py-3">
          <h3 className="text-lg font-semibold text-haidee-text">
            {sectionTitle.label}{" "}
            <span className="text-sm font-normal text-haidee-muted">
              {sectionTitle.labelEn}
            </span>
          </h3>
        </div>

        <div className="p-4">
        {activeSection === "shippers" && (
          <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/settings/sub-customer-channels"
              className={buttonVariants({ variant: "outline" })}
            >
              子顾客渠道 Sub-customers
            </Link>
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
                  invoiceCompany: "haidee",
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
                          invoiceCompany: s.invoiceCompany ?? "haidee",
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
          </>
        )}

        {activeSection === "receivers" && (
          <>
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setStallForm({
                  code: "",
                  name: "",
                  marketId: data.markets[0]?.id ?? "",
                  consigneeId: "",
                  active: true,
                });
                setDialog("stall");
              }}
              className="gap-2 bg-haidee-blue text-white"
            >
              <Plus className="h-4 w-4" /> 新增收货人
            </Button>
          </div>
          <DataTable>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>代码 Code</TableHead>
                <TableHead>名称 Name</TableHead>
                <TableHead>市场 Market</TableHead>
                <TableHead>收货人 Consignee</TableHead>
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
                  <TableCell>
                    {s.consigneeName
                      ? `${s.consigneeName} (${s.consigneeCode})`
                      : "—"}
                  </TableCell>
                  <TableCell><ActiveBadge active={s.active} /></TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(s.id);
                        setStallForm({
                          code: s.code,
                          name: s.name ?? "",
                          marketId: s.marketId ?? "",
                          consigneeId: s.consigneeId ?? "",
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
          </>
        )}

        {activeSection === "defaults" && (
          <>
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setDefaultForm({
                  shipperId: data.shippers[0]?.id ?? "",
                  stallId: data.stalls[0]?.id ?? "",
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
                <TableHead>收货人 Receiver</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.defaults.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.shipperName}</TableCell>
                  <TableCell className="font-mono">{d.marketCode}</TableCell>
                  <TableCell className="font-mono">{d.stallCode}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(d.id);
                        setDefaultForm({
                          shipperId: d.shipperId,
                          stallId: d.stallId,
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
          </>
        )}

        {activeSection === "trucks" && (
          <>
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditId(undefined);
                setTruckInitialValue(undefined);
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
                <TableHead>国家 Country</TableHead>
                <TableHead>默认司机 Default Driver</TableHead>
                <TableHead>类型 Type</TableHead>
                <TableHead>Toll Class</TableHead>
                <TableHead className="text-right">容量 Capacity</TableHead>
                <TableHead className="text-right">合计/km Total</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trucks.map((t) => {
                const countryMeta = getTruckCountryMeta(t.country);
                const fuelPerKm = calcFuelCostPerKm(
                  fuelPriceForCountry(t.country, freightData.fuelPrice),
                  t.fuelEfficiencyKmPerL
                );
                const totalPerKm = calcGrandTotalPerKm(
                  t.costItems,
                  t.annualMileageKm,
                  fuelPerKm
                );

                return (
                <TableRow key={t.id}>
                  <TableCell className="font-mono font-semibold">{t.plate}</TableCell>
                  <TableCell>
                    {countryMeta.label}{" "}
                    <span className="text-xs text-haidee-muted">
                      {countryMeta.labelEn}
                    </span>
                  </TableCell>
                  <TableCell>{t.defaultDriverName || "—"}</TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell className="font-mono uppercase">{t.tollClass}</TableCell>
                  <TableCell className="text-right font-mono">
                    {t.capacityTong ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {totalPerKm != null
                      ? `${totalPerKm.toFixed(4)} ${countryMeta.currency}`
                      : "—"}
                  </TableCell>
                  <TableCell><ActiveBadge active={t.active} /></TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => {
                        setEditId(t.id);
                        setTruckInitialValue({
                          plate: t.plate,
                          type: t.type,
                          country: t.country,
                          tollClass: t.tollClass,
                          capacityTong: t.capacityTong ?? undefined,
                          defaultDriverId: t.defaultDriverId,
                          sortOrder: t.sortOrder,
                          fuelEfficiencyKmPerL: t.fuelEfficiencyKmPerL,
                          annualMileageKm: t.annualMileageKm,
                          costItems: t.costItems.map((item) => ({
                            name: item.name,
                            annualAmount: item.annualAmount,
                          })),
                          active: t.active,
                        });
                        setDialog("truck");
                      }}
                      onDelete={() => runAction(async () => deleteTruck(t.id))}
                      disabled={isPending}
                    />
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
          </>
        )}

        {activeSection === "users" && (
          <>
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
                      {getRoleLabel(u.role as StoredUserRole)}
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
          </>
        )}

        {(activeSection === "shipper-rates" ||
          activeSection === "consignee-rates" ||
          activeSection === "payment-relations") && (
          <FreightRatesSection data={freightData} view={activeSection} />
        )}

        {activeSection === "operations-settings" && (
          <>
          {freightData.exchangeAlert.missing && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              提醒：{freightData.exchangeAlert.currentYearMonth} 当月汇率尚未设定。
            </div>
          )}
          <OperationsSettingsSection
            exchangeRates={freightData.exchangeRates}
            exchangeAlert={freightData.exchangeAlert}
            fuelPrice={freightData.fuelPrice}
            operationalSettings={freightData.operationalSettings}
            thaiSegmentRates={freightData.thaiSegmentRates}
            globalCosts={freightData.globalCosts}
          />
          </>
        )}

        {activeSection === "driver-payroll" && (
          <DriverPayrollSettingsSection drivers={driverPayrollDrivers} />
        )}

        {activeSection === "routes" && (
          <RouteMasterSettingsSection routes={routeMasters} />
        )}

        {activeSection === "payroll-settings" && payrollSettings && (
          <PayrollSettingsSection
            routes={payrollSettings.routes}
            extraMarketAllowance={payrollSettings.extraMarketAllowance}
            bigTruckCrateCommission={payrollSettings.bigTruckCrateCommission}
            smallTruckCrateCommission={
              payrollSettings.smallTruckCrateCommission
            }
            bpCrateCommissionBigTruck={payrollSettings.bpCrateCommissionBigTruck}
            bpCrateCommissionSmallTruck={
              payrollSettings.bpCrateCommissionSmallTruck
            }
            crateReturnMultiMarketAllowance={
              payrollSettings.crateReturnMultiMarketAllowance
            }
          />
        )}

        {activeSection === "crate-rental-rates" && (
          <CrateRentalRatesSection rates={crateRentalRates} />
        )}

        {activeSection === "unload-settings" && <UnloadingRatesSettings />}
        </div>
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
        <FormField label="开单公司 Invoice Company (1a)">
          <select
            value={shipperForm.invoiceCompany}
            onChange={(e) =>
              setShipperForm({ ...shipperForm, invoiceCompany: e.target.value })
            }
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            {SHIPPER_INVOICE_COMPANIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
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
        title={editId ? "编辑收货人 Edit Receiver" : "新增收货人 New Receiver"}
        onSave={() =>
          runAction(async () =>
            saveStall({
              id: editId,
              ...stallForm,
              consigneeId: stallForm.consigneeId || null,
            })
          )
        }
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
        <FormField label="收货人 Consignee">
          <select
            value={stallForm.consigneeId}
            onChange={(e) =>
              setStallForm({ ...stallForm, consigneeId: e.target.value })
            }
            className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="">— 未关联 None —</option>
            {freightData.allConsignees
              .filter((consignee) => consignee.active)
              .map((consignee) => (
                <option key={consignee.id} value={consignee.id}>
                  {consignee.name} ({consignee.code})
                </option>
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
        <FormField label="收货人 Receiver">
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
      </FormDialog>

      <TruckFormDialog
        open={dialog === "truck"}
        onClose={() => setDialog(null)}
        title={editId ? "编辑车辆 Edit Truck" : "新增车辆 New Truck"}
        drivers={data.drivers}
        fuelPrice={freightData.fuelPrice}
        initialValue={truckInitialValue}
        isPending={isPending}
        onSave={(value) =>
          runAction(async () =>
            saveTruck({
              id: editId,
              ...value,
            })
          )
        }
      />

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
            <option value="clerk">{getRoleLabel("clerk")}</option>
            <option value="admin">{getRoleLabel("admin")}</option>
            <option value="thai_accounting">{getRoleLabel("thai_accounting")}</option>
            <option value="my_accounting">{getRoleLabel("my_accounting")}</option>
            <option value="viewer">{getRoleLabel("viewer")}</option>
            {isLegacyUserRole(userForm.role) && (
              <option value={userForm.role}>
                {getRoleLabel(userForm.role as StoredUserRole)}
              </option>
            )}
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
