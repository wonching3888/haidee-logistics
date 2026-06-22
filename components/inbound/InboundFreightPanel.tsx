"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/components/shared/locale-context";
import {
  getBillingCompanyLabel,
  getPaymentModeLabel,
} from "@/lib/constants/freight-settings";
import { decimalToNumber } from "@/lib/freight-rates";
import type { MessageKey } from "@/lib/i18n/messages";

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
  const amount = decimalToNumber(value);
  if (amount == null) return "—";
  const formatted = amount.toFixed(2);
  return currency ? `${formatted} ${currency}` : formatted;
}

function FreightTableHead({
  messageKey,
  localOnly = false,
}: {
  messageKey: MessageKey;
  localOnly?: boolean;
}) {
  const { parts, tLocal } = useT();
  if (localOnly) {
    return <TableHead>{tLocal(messageKey)}</TableHead>;
  }
  const { local, en } = parts(messageKey);
  return (
    <TableHead>
      <div>{local}</div>
      {en ? <div className="text-[10px] text-haidee-muted">{en}</div> : null}
    </TableHead>
  );
}

function PaymentPartyCell({
  party,
}: {
  party: string | null | undefined;
}) {
  const { t } = useT();
  if (party === "consignee") return t("freight.consignee");
  if (party === "shipper") return t("freight.shipper");
  return "—";
}

function PaymentModeCell({ mode }: { mode: string | null | undefined }) {
  const { locale } = useT();
  if (!mode) return "—";
  return getPaymentModeLabel(mode, locale);
}

export function InboundFreightPanel({ lines }: InboundFreightPanelProps) {
  const { parts, tLocal } = useT();
  const title = parts("freight.title");
  const hasThSplit = lines.some(
    (line) =>
      line.thFreightAmount != null || line.mySegmentFreightAmount != null
  );

  return (
    <div className="space-y-3 rounded-lg border border-haidee-border bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-haidee-text">
          {title.local}
          {title.en ? ` ${title.en}` : ""}
        </h3>
        <p className="text-xs text-haidee-muted">
          {tLocal("freight.visibleNote")}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-haidee-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <FreightTableHead messageKey="common.receiver" />
              <FreightTableHead messageKey="common.crateType" />
              <FreightTableHead messageKey="common.qty" />
              <FreightTableHead messageKey="freight.payer" />
              <FreightTableHead messageKey="freight.mode" />
              <FreightTableHead messageKey="freight.rate" />
              <FreightTableHead messageKey="freight.amount" />
              <FreightTableHead messageKey="freight.currency" />
              <FreightTableHead messageKey="freight.billing" />
              {hasThSplit && (
                <>
                  <FreightTableHead messageKey="freight.myRate" localOnly />
                  <FreightTableHead messageKey="freight.myAmount" localOnly />
                  <FreightTableHead messageKey="freight.thRate" localOnly />
                  <FreightTableHead messageKey="freight.thAmount" localOnly />
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
                <TableCell>
                  <PaymentPartyCell party={line.paymentParty} />
                </TableCell>
                <TableCell>
                  <PaymentModeCell mode={line.paymentMode} />
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
                {hasThSplit && (
                  <>
                    <TableCell className="font-mono">
                      {formatMoney(line.mySegmentFreightRate, "MYR")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(line.mySegmentFreightAmount, "MYR")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(
                        line.thFreightRate,
                        line.currency === "MYR" ? "MYR" : "THB"
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(
                        line.thFreightAmount,
                        line.currency === "MYR" ? "MYR" : "THB"
                      )}
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
