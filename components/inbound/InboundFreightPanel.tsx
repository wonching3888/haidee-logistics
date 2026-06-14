"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBillingCompanyLabel,
  getPaymentModeLabel,
} from "@/lib/constants/freight-settings";
import { MC_MARKET_CODE } from "@/lib/inbound-freight";

export interface InboundFreightLine {
  id: string;
  stallCode: string;
  marketCode: string;
  tongTypeCode: string;
  quantity: number;
  mcDeliveryMode?: "self" | "third_party" | null;
  paymentParty?: "shipper" | "consignee" | null;
  paymentMode?: string | null;
  currency?: string | null;
  billingCompany?: string | null;
  freightRate?: number | null;
  freightAmount?: number | null;
  thirdPartyFee?: number | null;
  mySegmentFreightRate?: number | null;
  mySegmentFreightAmount?: number | null;
  thFreightRate?: number | null;
  thFreightAmount?: number | null;
}

interface InboundFreightPanelProps {
  lines: InboundFreightLine[];
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value == null) return "—";
  const formatted = value.toFixed(2);
  return currency ? `${formatted} ${currency}` : formatted;
}

function paymentPartyLabel(party: string | null | undefined) {
  if (party === "consignee") return "收货人 Consignee";
  if (party === "shipper") return "寄货人 Shipper";
  return "—";
}

function mcModeLabel(mode: string | null | undefined) {
  if (mode === "third_party") return "转第三方";
  if (mode === "self") return "自送";
  return "—";
}

export function InboundFreightPanel({ lines }: InboundFreightPanelProps) {
  const hasThSplit = lines.some(
    (line) =>
      line.thFreightAmount != null || line.mySegmentFreightAmount != null
  );

  return (
    <div className="space-y-3 rounded-lg border border-haidee-border bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-haidee-text">
          车力信息 Freight Details
        </h3>
        <p className="text-xs text-haidee-muted">
          仅 Admin / Accounting / Owner 可见。Operation 角色不可见此区域。
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-haidee-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>收货人 Receiver</TableHead>
              <TableHead>桶型 Type</TableHead>
              <TableHead>数量 Qty</TableHead>
              <TableHead>付款方 Payer</TableHead>
              <TableHead>付款模式 Mode</TableHead>
              <TableHead>费率/桶 Rate</TableHead>
              <TableHead>车力金额 Amount</TableHead>
              <TableHead>币种 Curr.</TableHead>
              <TableHead>开单公司 Billing</TableHead>
              {lines.some((l) => l.marketCode === MC_MARKET_CODE) && (
                <>
                  <TableHead>MC 模式</TableHead>
                  <TableHead>第三方费用</TableHead>
                </>
              )}
              {hasThSplit && (
                <>
                  <TableHead>MY段费率</TableHead>
                  <TableHead>MY段金额</TableHead>
                  <TableHead>泰国段费率</TableHead>
                  <TableHead>泰国段金额</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div className="font-medium">{line.stallCode}</div>
                  <div className="text-xs text-haidee-muted">{line.marketCode}</div>
                </TableCell>
                <TableCell className="font-mono">{line.tongTypeCode}</TableCell>
                <TableCell className="font-mono">{line.quantity}</TableCell>
                <TableCell>{paymentPartyLabel(line.paymentParty)}</TableCell>
                <TableCell>
                  {line.paymentMode
                    ? getPaymentModeLabel(line.paymentMode)
                    : "—"}
                </TableCell>
                <TableCell className="font-mono">
                  {formatMoney(line.freightRate, line.currency)}
                </TableCell>
                <TableCell className="font-mono">
                  {formatMoney(line.freightAmount, line.currency)}
                </TableCell>
                <TableCell>{line.currency ?? "—"}</TableCell>
                <TableCell>
                  {line.billingCompany
                    ? getBillingCompanyLabel(line.billingCompany)
                    : "—"}
                </TableCell>
                {lines.some((l) => l.marketCode === MC_MARKET_CODE) && (
                  <>
                    <TableCell>
                      {line.marketCode === MC_MARKET_CODE
                        ? mcModeLabel(line.mcDeliveryMode)
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {line.marketCode === MC_MARKET_CODE
                        ? formatMoney(line.thirdPartyFee, line.currency)
                        : "—"}
                    </TableCell>
                  </>
                )}
                {hasThSplit && (
                  <>
                    <TableCell className="font-mono">
                      {formatMoney(line.mySegmentFreightRate, "MYR")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(line.mySegmentFreightAmount, "MYR")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(line.thFreightRate, "THB")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(line.thFreightAmount, "THB")}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
