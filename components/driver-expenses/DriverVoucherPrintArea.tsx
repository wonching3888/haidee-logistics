"use client";

import {
  formatMyr,
  sumSuggestedAmounts,
  VOUCHER_PRINT_LABELS,
  type DriverVoucherData,
  type VoucherPrintBreakdown,
  type VoucherPrintMarketRow,
} from "@/lib/driver-expense/voucher-utils";

function formatAmt(value: number | null): string {
  return value != null ? formatMyr(value) : "—";
}

function FeeRow({
  label,
  suggested,
  actual,
  bold,
}: {
  label: string;
  suggested: number | null;
  actual: number | null;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "voucher-print-subtotal-row" : undefined}>
      <td className={bold ? "font-bold" : undefined}>{label}</td>
      <td className={`text-right font-mono ${bold ? "font-bold" : ""}`}>
        {formatAmt(suggested)}
      </td>
      <td className={`text-right font-mono ${bold ? "font-bold" : ""}`}>
        {formatAmt(actual)}
      </td>
    </tr>
  );
}

function MarketSplitRows({
  labelPrefix,
  rows,
  actualTotal,
  fallbackSuggested,
}: {
  labelPrefix: string;
  rows: VoucherPrintMarketRow[];
  actualTotal: number | null;
  fallbackSuggested: number | null;
}) {
  if (rows.length === 0) {
    return (
      <FeeRow
        label={labelPrefix}
        suggested={fallbackSuggested}
        actual={actualTotal}
      />
    );
  }
  return (
    <>
      {rows.map((row, index) => (
        <FeeRow
          key={`${labelPrefix}-${row.market}`}
          label={`${labelPrefix} ${row.market}`}
          suggested={row.suggested}
          actual={index === rows.length - 1 ? actualTotal : null}
        />
      ))}
    </>
  );
}

interface DriverVoucherPrintAreaProps {
  voucher: DriverVoucherData;
  breakdown: VoucherPrintBreakdown | null;
}

export function DriverVoucherPrintArea({
  voucher,
  breakdown,
}: DriverVoucherPrintAreaProps) {
  const suggestedSubtotal = sumSuggestedAmounts({
    chopBorderAmt: voucher.chopBorderAmt,
    parkingAmt: voucher.parkingAmt,
    kpbAmt: voucher.kpbAmt,
    fishCheckAmt: voucher.fishCheckAmt,
    upahTurunAmt: voucher.upahTurunAmt,
    upahNaikTongAmt: voucher.upahNaikTongAmt,
    minyakMotoEnabled: voucher.minyakMotoEnabled,
    minyakMotoAmt: voucher.minyakMotoAmt,
  });

  const bakiClass =
    voucher.baki != null && voucher.baki >= 0
      ? "text-green-700"
      : voucher.baki != null
        ? "text-red-700"
        : "";

  return (
    <div className="voucher-print-area" aria-hidden="true">
      <div className="voucher-print-company">Hai Dee Logistics Co.,Ltd</div>

      <div className="voucher-print-header-grid">
        <div>
          <div>
            <span className="voucher-print-label">{VOUCHER_PRINT_LABELS.nama}</span>{" "}
            {voucher.driverName}
          </div>
          <div>
            <span className="voucher-print-label">{VOUCHER_PRINT_LABELS.noLorry}</span>{" "}
            {voucher.lorry}
          </div>
        </div>
        <div className="voucher-print-header-right">
          <div>
            <span className="voucher-print-label">{VOUCHER_PRINT_LABELS.voucherNo}</span>{" "}
            {voucher.voucherNo}
          </div>
          <div>
            <span className="voucher-print-label">{VOUCHER_PRINT_LABELS.tarikh}</span>{" "}
            {voucher.tripDate}
          </div>
          <div>
            <span className="voucher-print-label">{VOUCHER_PRINT_LABELS.trip}</span>{" "}
            {voucher.route}
          </div>
        </div>
      </div>

      <table className="voucher-print-table">
        <thead>
          <tr>
            <th>{VOUCHER_PRINT_LABELS.perkara}</th>
            <th className="text-right">{VOUCHER_PRINT_LABELS.cadanganRm}</th>
            <th className="text-right">{VOUCHER_PRINT_LABELS.sebenarRm}</th>
          </tr>
        </thead>
        <tbody>
          <FeeRow
            label="Chop Border"
            suggested={voucher.chopBorderAmt}
            actual={voucher.chopBorderActual}
          />
          <MarketSplitRows
            labelPrefix="Parking"
            rows={breakdown?.parking ?? []}
            actualTotal={voucher.parkingActual}
            fallbackSuggested={voucher.parkingAmt}
          />
          <MarketSplitRows
            labelPrefix="KPB"
            rows={breakdown?.kpb ?? []}
            actualTotal={voucher.kpbActual}
            fallbackSuggested={voucher.kpbAmt}
          />
          <FeeRow
            label="Semak Ikan / Fish Check"
            suggested={voucher.fishCheckAmt}
            actual={voucher.fishCheckActual}
          />
          <MarketSplitRows
            labelPrefix="Upah Turun / Unloading"
            rows={breakdown?.upahTurun ?? []}
            actualTotal={voucher.upahTurunActual}
            fallbackSuggested={voucher.upahTurunAmt}
          />
          <FeeRow
            label={
              breakdown?.upahNaikTongLabel ??
              "Upah Naik Tong / Crate Loading"
            }
            suggested={
              breakdown?.upahNaikTongSuggested ?? voucher.upahNaikTongAmt
            }
            actual={voucher.upahNaikTongActual}
          />
          {voucher.minyakMotoEnabled && (
            <FeeRow
              label={VOUCHER_PRINT_LABELS.minyakMoto}
              suggested={voucher.minyakMotoAmt}
              actual={voucher.minyakMotoActual}
            />
          )}
          {(voucher.otherActual ?? 0) > 0 && (
            <FeeRow
              label={VOUCHER_PRINT_LABELS.lainLain}
              suggested={null}
              actual={voucher.otherActual}
            />
          )}
          <FeeRow
            label={VOUCHER_PRINT_LABELS.subtotal}
            suggested={suggestedSubtotal}
            actual={voucher.belanja}
            bold
          />
        </tbody>
      </table>

      <div className="voucher-print-summary-wrap">
        <table className="voucher-print-summary">
          <tbody>
            <tr>
              <td>{VOUCHER_PRINT_LABELS.duitJalan}</td>
              <td className="text-right">{formatAmt(voucher.duitJalan)}</td>
            </tr>
            <tr>
              <td>{VOUCHER_PRINT_LABELS.belanja}</td>
              <td className="text-right">{formatAmt(voucher.belanja)}</td>
            </tr>
            <tr>
              <td>{VOUCHER_PRINT_LABELS.baki}</td>
              <td className={`text-right font-semibold ${bakiClass}`}>
                {formatAmt(voucher.baki)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="voucher-print-signature">
        <div>Driver Signature / Tandatangan Pemandu</div>
        <div className="voucher-print-signature-line" />
      </div>
    </div>
  );
}

export async function fetchVoucherPrintBreakdown(
  tripId: string
): Promise<VoucherPrintBreakdown | null> {
  try {
    const res = await fetch(
      `/api/driver-vouchers/print-breakdown?tripId=${encodeURIComponent(tripId)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { breakdown?: VoucherPrintBreakdown };
    return data.breakdown ?? null;
  } catch {
    return null;
  }
}
