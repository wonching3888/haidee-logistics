"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { DateInputField } from "@/components/shared/DateInputField";
import {
  BILLING_COMPANIES,
  getBillingCompanyLabel,
  getPaymentModeLabel,
  PAYMENT_MODES,
} from "@/lib/constants/freight-settings";
import { getNextMonthFirstDayInput, parseOptionalRate, type RateCell } from "@/lib/freight-rates";
import {
  deleteConsignee,
  deletePaymentRelation,
  saveConsignee,
  saveConsigneeFreightRates,
  savePaymentRelation,
  saveShipperFreightRates,
} from "@/app/actions/freight-settings";

interface FreightMarket {
  id: string;
  code: string;
  name: string;
}

interface ShipperRateRow {
  id: string;
  code: string;
  name: string;
  currency: string;
  matrix: Record<string, RateCell>;
}

interface ConsigneeSummary {
  id: string;
  code: string;
  name: string;
  billingCompany: string;
  active: boolean;
}

interface ConsigneeRateRow extends ConsigneeSummary {
  matrix: Record<string, RateCell>;
}

interface PaymentRelationRow {
  id: string;
  shipperId: string;
  shipperName: string;
  shipperCode: string;
  consigneeId: string;
  consigneeName: string;
  consigneeCode: string;
  paymentMode: string;
}

export interface FreightSettingsData {
  freightMarkets: FreightMarket[];
  shippers: ShipperRateRow[];
  consignees: ConsigneeRateRow[];
  allConsignees: ConsigneeSummary[];
  allShippers: { id: string; code: string; name: string; currency: string }[];
  paymentRelations: PaymentRelationRow[];
}

interface FreightRatesSectionProps {
  data: FreightSettingsData;
}

type RateDialogState =
  | {
      kind: "shipper" | "consignee";
      entityId: string;
      entityName: string;
      currencyLabel?: string;
    }
  | null;

function RateCellDisplay({ cell }: { cell?: RateCell }) {
  if (!cell || (cell.rateTong == null && cell.rateBox == null)) {
    return <span className="text-haidee-muted">—</span>;
  }

  return (
    <div className="space-y-0.5 font-mono text-[11px] leading-tight">
      <div>T {cell.rateTong ?? "—"}</div>
      <div>B {cell.rateBox ?? "—"}</div>
    </div>
  );
}

function RateMatrixTable({
  rows,
  markets,
  currencyColumn,
  extraColumn,
  onEdit,
}: {
  rows: Array<{
    id: string;
    name: string;
    code: string;
    matrix: Record<string, RateCell>;
    currency?: string;
    billingCompany?: string;
  }>;
  markets: FreightMarket[];
  currencyColumn?: boolean;
  extraColumn?: (row: (typeof rows)[number]) => React.ReactNode;
  onEdit: (row: (typeof rows)[number]) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-haidee-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
            <TableHead className="sticky left-0 z-10 min-w-[160px] bg-haidee-surface">
              名称 Name
            </TableHead>
            {currencyColumn && <TableHead>币种</TableHead>}
            {extraColumn && <TableHead>开单公司</TableHead>}
            {markets.map((market) => (
              <TableHead key={market.id} colSpan={2} className="text-center">
                <div className="font-semibold">{market.code}</div>
                <div className="text-[10px] font-normal text-haidee-muted">
                  TONG / BOX
                </div>
              </TableHead>
            ))}
            <TableHead className="sticky right-0 z-10 bg-haidee-surface text-right">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={markets.length * 2 + 4}
                className="py-8 text-center text-haidee-muted"
              >
                暂无数据 No data
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="sticky left-0 z-10 bg-white">
                  <div className="font-medium">{row.name}</div>
                  <div className="font-mono text-xs text-haidee-muted">
                    {row.code}
                  </div>
                </TableCell>
                {currencyColumn && (
                  <TableCell>
                    <Badge variant="secondary">{row.currency}</Badge>
                  </TableCell>
                )}
                {extraColumn && <TableCell>{extraColumn(row)}</TableCell>}
                {markets.map((market) => (
                  <TableCell key={market.id} colSpan={2} className="min-w-[72px]">
                    <RateCellDisplay cell={row.matrix[market.code]} />
                  </TableCell>
                ))}
                <TableCell className="sticky right-0 z-10 bg-white text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => onEdit(row)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function FreightRatesSection({ data }: FreightRatesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rateDialog, setRateDialog] = useState<RateDialogState>(null);
  const [rateInputs, setRateInputs] = useState<
    Record<string, { tong: string; box: string }>
  >({});
  const [immediate, setImmediate] = useState(true);
  const [scheduledDate, setScheduledDate] = useState(getNextMonthFirstDayInput());

  const [consigneeDialog, setConsigneeDialog] = useState(false);
  const [consigneeEditId, setConsigneeEditId] = useState<string | undefined>();
  const [consigneeForm, setConsigneeForm] = useState({
    code: "",
    name: "",
    billingCompany: "haidee",
    active: true,
  });

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentEditId, setPaymentEditId] = useState<string | undefined>();
  const [paymentForm, setPaymentForm] = useState({
    shipperId: "",
    consigneeId: "",
    paymentMode: "1a",
  });

  const activeConsignees = useMemo(
    () => data.allConsignees.filter((item) => item.active),
    [data.allConsignees]
  );

  function refresh() {
    router.refresh();
  }

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setRateDialog(null);
        setConsigneeDialog(false);
        setPaymentDialog(false);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function openRateDialog(
    kind: "shipper" | "consignee",
    row: ShipperRateRow | ConsigneeRateRow
  ) {
    const nextInputs: Record<string, { tong: string; box: string }> = {};
    for (const market of data.freightMarkets) {
      const cell = row.matrix[market.code];
      nextInputs[market.id] = {
        tong: cell?.rateTong != null ? String(cell.rateTong) : "",
        box: cell?.rateBox != null ? String(cell.rateBox) : "",
      };
    }
    setRateInputs(nextInputs);
    setImmediate(true);
    setScheduledDate(getNextMonthFirstDayInput());
    setRateDialog({
      kind,
      entityId: row.id,
      entityName: row.name,
      currencyLabel:
        kind === "shipper" && "currency" in row ? row.currency : "MYR",
    });
  }

  function saveRateDialog() {
    if (!rateDialog) return;

    runAction(async () => {
      const rates = data.freightMarkets.map((market) => {
        const input = rateInputs[market.id] ?? { tong: "", box: "" };
        return {
          marketId: market.id,
          rateTong: parseOptionalRate(input.tong),
          rateBox: parseOptionalRate(input.box),
        };
      });

      if (rateDialog.kind === "shipper") {
        await saveShipperFreightRates({
          shipperId: rateDialog.entityId,
          rates,
          immediate,
          scheduledDate: immediate ? undefined : scheduledDate,
        });
      } else {
        await saveConsigneeFreightRates({
          consigneeId: rateDialog.entityId,
          rates,
          immediate,
          scheduledDate: immediate ? undefined : scheduledDate,
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <Tabs defaultValue="shipper-rates" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1 bg-haidee-surface p-1">
          <TabsTrigger value="shipper-rates">寄货人费率 Shipper Rates</TabsTrigger>
          <TabsTrigger value="consignee-rates">
            收货人费率 Consignee Rates
          </TabsTrigger>
          <TabsTrigger value="payment-relations">
            付款关系 Payment Relations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shipper-rates" className="space-y-3">
          <p className="text-sm text-haidee-muted">
            币种按寄货人设定；修改时可选择立即生效或指定生效日期。历史已录入数据不会自动重算。
          </p>
          <RateMatrixTable
            rows={data.shippers}
            markets={data.freightMarkets}
            currencyColumn
            onEdit={(row) => openRateDialog("shipper", row as ShipperRateRow)}
          />
        </TabsContent>

        <TabsContent value="consignee-rates" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-haidee-muted">
              全部 MYR；开单公司标注 HAIDEE / WTL。
            </p>
            <Button
              type="button"
              className="gap-2 bg-haidee-blue text-white"
              onClick={() => {
                setConsigneeEditId(undefined);
                setConsigneeForm({
                  code: "",
                  name: "",
                  billingCompany: "haidee",
                  active: true,
                });
                setConsigneeDialog(true);
              }}
            >
              <Plus className="h-4 w-4" />
              新增收货人
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-haidee-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                  <TableHead>代码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>开单公司</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.allConsignees.map((consignee) => (
                  <TableRow key={consignee.id}>
                    <TableCell className="font-mono">{consignee.code}</TableCell>
                    <TableCell>{consignee.name}</TableCell>
                    <TableCell>
                      {getBillingCompanyLabel(consignee.billingCompany)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={consignee.active ? "default" : "secondary"}>
                        {consignee.active ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setConsigneeEditId(consignee.id);
                            setConsigneeForm({
                              code: consignee.code,
                              name: consignee.name,
                              billingCompany: consignee.billingCompany,
                              active: consignee.active,
                            });
                            setConsigneeDialog(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {consignee.active && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              runAction(async () => deleteConsignee(consignee.id))
                            }
                            disabled={isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <RateMatrixTable
            rows={data.consignees}
            markets={data.freightMarkets}
            extraColumn={(row) => getBillingCompanyLabel(row.billingCompany ?? "haidee")}
            onEdit={(row) => openRateDialog("consignee", row as ConsigneeRateRow)}
          />
        </TabsContent>

        <TabsContent value="payment-relations" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-haidee-muted">
              未设定关系的寄货人/收货人组合默认寄货人付款（1a）。
            </p>
            <Button
              type="button"
              className="gap-2 bg-haidee-blue text-white"
              onClick={() => {
                setPaymentEditId(undefined);
                setPaymentForm({
                  shipperId: data.allShippers[0]?.id ?? "",
                  consigneeId: activeConsignees[0]?.id ?? "",
                  paymentMode: "1a",
                });
                setPaymentDialog(true);
              }}
            >
              <Plus className="h-4 w-4" />
              新增关系
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-haidee-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                  <TableHead>寄货人 Shipper</TableHead>
                  <TableHead>收货人 Consignee</TableHead>
                  <TableHead>付款模式 Payment Mode</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.paymentRelations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-haidee-muted">
                      暂无付款关系 No payment relations
                    </TableCell>
                  </TableRow>
                ) : (
                  data.paymentRelations.map((relation) => (
                    <TableRow key={relation.id}>
                      <TableCell>
                        <div>{relation.shipperName}</div>
                        <div className="font-mono text-xs text-haidee-muted">
                          {relation.shipperCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{relation.consigneeName}</div>
                        <div className="font-mono text-xs text-haidee-muted">
                          {relation.consigneeCode}
                        </div>
                      </TableCell>
                      <TableCell>{getPaymentModeLabel(relation.paymentMode)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPaymentEditId(relation.id);
                              setPaymentForm({
                                shipperId: relation.shipperId,
                                consigneeId: relation.consigneeId,
                                paymentMode: relation.paymentMode,
                              });
                              setPaymentDialog(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              runAction(async () =>
                                deletePaymentRelation(relation.id)
                              )
                            }
                            disabled={isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!rateDialog} onOpenChange={() => setRateDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              编辑费率 Edit Rates — {rateDialog?.entityName}
              {rateDialog?.currencyLabel ? ` (${rateDialog.currencyLabel})` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.freightMarkets.map((market) => (
              <div
                key={market.id}
                className="rounded-lg border border-haidee-border p-3"
              >
                <div className="mb-2 font-semibold">{market.code}</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
                    <span className="text-haidee-muted">TONG</span>
                    <Input
                      value={rateInputs[market.id]?.tong ?? ""}
                      onChange={(e) =>
                        setRateInputs((prev) => ({
                          ...prev,
                          [market.id]: {
                            tong: e.target.value,
                            box: prev[market.id]?.box ?? "",
                          },
                        }))
                      }
                      className="min-h-[40px] font-mono"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-haidee-muted">BOX</span>
                    <Input
                      value={rateInputs[market.id]?.box ?? ""}
                      onChange={(e) =>
                        setRateInputs((prev) => ({
                          ...prev,
                          [market.id]: {
                            tong: prev[market.id]?.tong ?? "",
                            box: e.target.value,
                          },
                        }))
                      }
                      className="min-h-[40px] font-mono"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-lg border border-haidee-border bg-haidee-surface/40 p-4">
            <div className="text-sm font-medium">生效日期 Effective Date</div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={immediate}
                onChange={() => setImmediate(true)}
              />
              立即生效 Immediate
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!immediate}
                onChange={() => setImmediate(false)}
              />
              指定日期 Scheduled
            </label>
            {!immediate && (
              <DateInputField
                value={scheduledDate}
                onChange={setScheduledDate}
                className="max-w-xs"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRateDialog(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-haidee-blue text-white"
              disabled={isPending}
              onClick={saveRateDialog}
            >
              保存 Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={consigneeDialog} onOpenChange={setConsigneeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {consigneeEditId ? "编辑收货人 Edit Consignee" : "新增收货人 New Consignee"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              代码 Code
              <Input
                value={consigneeForm.code}
                onChange={(e) =>
                  setConsigneeForm({ ...consigneeForm, code: e.target.value })
                }
                className="min-h-[44px]"
              />
            </label>
            <label className="block space-y-1 text-sm">
              名称 Name
              <Input
                value={consigneeForm.name}
                onChange={(e) =>
                  setConsigneeForm({ ...consigneeForm, name: e.target.value })
                }
                className="min-h-[44px]"
              />
            </label>
            <label className="block space-y-1 text-sm">
              开单公司 Billing Company
              <select
                value={consigneeForm.billingCompany}
                onChange={(e) =>
                  setConsigneeForm({
                    ...consigneeForm,
                    billingCompany: e.target.value,
                  })
                }
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                {BILLING_COMPANIES.map((company) => (
                  <option key={company.value} value={company.value}>
                    {company.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={consigneeForm.active}
                onChange={(e) =>
                  setConsigneeForm({
                    ...consigneeForm,
                    active: e.target.checked,
                  })
                }
              />
              启用 Active
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConsigneeDialog(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-haidee-blue text-white"
              disabled={isPending}
              onClick={() =>
                runAction(async () =>
                  saveConsignee({ id: consigneeEditId, ...consigneeForm })
                )
              }
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentEditId ? "编辑付款关系 Edit Relation" : "新增付款关系 New Relation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              寄货人 Shipper
              <select
                value={paymentForm.shipperId}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, shipperId: e.target.value })
                }
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                {data.allShippers.map((shipper) => (
                  <option key={shipper.id} value={shipper.id}>
                    {shipper.name} ({shipper.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              收货人 Consignee
              <select
                value={paymentForm.consigneeId}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, consigneeId: e.target.value })
                }
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                {activeConsignees.map((consignee) => (
                  <option key={consignee.id} value={consignee.id}>
                    {consignee.name} ({consignee.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              付款模式 Payment Mode
              <select
                value={paymentForm.paymentMode}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, paymentMode: e.target.value })
                }
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPaymentDialog(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-haidee-blue text-white"
              disabled={isPending}
              onClick={() =>
                runAction(async () =>
                  savePaymentRelation({ id: paymentEditId, ...paymentForm })
                )
              }
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
