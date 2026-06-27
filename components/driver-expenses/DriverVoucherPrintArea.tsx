"use client";

import { Fragment } from "react";

import {
  formatMyr,
  sumCharterSuggestedAmounts,
  sumSuggestedAmounts,
  VOUCHER_PRINT_LABELS,
  type DriverVoucherData,
  type VoucherPrintBreakdown,
} from "@/lib/driver-expense/voucher-utils";
import { formatKpbFeeRowLabel } from "@/lib/driver-expense/fee-labels";
import { useT } from "@/components/shared/locale-context";
import { PrintLetterhead } from "@/components/shared/PrintLogo";

function formatSuggested(value: number | null): string {
  return value != null ? formatMyr(value) : "—";
}

/** Paper form: suggested column shows system estimate; actual column left blank for handwriting. */
function FeeRow({
  label,
  suggested,
  bold,
}: {
  label: string;
  suggested: number | null;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "voucher-print-subtotal-row" : undefined}>
      <td className={bold ? "font-bold" : undefined}>{label}</td>
      <td className={`text-right font-mono ${bold ? "font-bold" : ""}`}>
        {formatSuggested(suggested)}
      </td>
      <td
        className={`text-right font-mono voucher-print-handwrite-cell ${bold ? "font-bold" : ""}`}
      />
    </tr>
  );
}

const MARKET_ORDER = ["KL", "MC", "A", "BM", "BM Pindah", "KD"] as const;

interface DriverVoucherPrintAreaProps {
  voucher: DriverVoucherData;
  breakdown: VoucherPrintBreakdown | null;
}

export function DriverVoucherPrintArea({
  voucher,
  breakdown,
}: DriverVoucherPrintAreaProps) {
  const { locale } = useT();
  const isCharter = voucher.tripSource === "charter";
  const parkingSuggested =
    breakdown?.parking.length
      ? breakdown.parking.reduce((sum, row) => sum + row.suggested, 0)
      : voucher.parkingAmt;
  const kpbSuggested =
    breakdown?.kpb.length
      ? breakdown.kpb.reduce((sum, row) => sum + row.suggested, 0)
      : voucher.kpbAmt;
  const upahTurunSuggested =
    breakdown?.upahTurun.length
      ? breakdown.upahTurun.reduce((sum, row) => sum + row.suggested, 0)
      : voucher.upahTurunAmt;
  const upahNaikTongSuggested =
    breakdown?.upahNaikTongSuggested ?? voucher.upahNaikTongAmt;
  const suggestedSubtotal = isCharter
    ? sumCharterSuggestedAmounts({
        chopBorderAmt: voucher.chopBorderAmt,
        upahTurunAmt: upahTurunSuggested,
        upahNaikTongAmt: upahNaikTongSuggested,
        minyakMotoEnabled: voucher.minyakMotoEnabled,
        minyakMotoAmt: voucher.minyakMotoAmt,
      })
    : sumSuggestedAmounts({
        chopBorderAmt: voucher.chopBorderAmt,
        parkingAmt: parkingSuggested,
        kpbAmt: kpbSuggested,
        fishCheckAmt: voucher.fishCheckAmt,
        upahTurunAmt: upahTurunSuggested,
        upahNaikTongAmt: upahNaikTongSuggested,
        minyakMotoEnabled: voucher.minyakMotoEnabled,
        minyakMotoAmt: voucher.minyakMotoAmt,
      });

  const parkingMap = new Map((breakdown?.parking ?? []).map((row) => [row.market, row]));
  const kpbMap = new Map((breakdown?.kpb ?? []).map((row) => [row.market, row]));
  const upahTurunMap = new Map((breakdown?.upahTurun ?? []).map((row) => [row.market, row]));
  const marketWithAnyRows = MARKET_ORDER.filter(
    (market) =>
      parkingMap.has(market) || kpbMap.has(market) || upahTurunMap.has(market)
  );

  return (
    <div className="voucher-print-area" aria-hidden="true">
      <PrintLetterhead nameEn="Hai Dee Logistics Co.,Ltd" />

      <div className="voucher-print-header-grid">
        <div>
          <div>
            <span className="voucher-print-label">{VOUCHER_PRINT_LABELS.nama}</span>{" "}
            {breakdown?.driverDisplayName || voucher.driverName}
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
          {isCharter && (
            <FeeRow label={VOUCHER_PRINT_LABELS.duitJalan} suggested={null} />
          )}
          <FeeRow label="Chop Border" suggested={voucher.chopBorderAmt} />
          {isCharter ? (
            <>
              <FeeRow label="Upah Turun" suggested={upahTurunSuggested} />
              <FeeRow
                label="Upah Naik Tong"
                suggested={upahNaikTongSuggested}
              />
            </>
          ) : (
            <>
              {marketWithAnyRows.map((market) => (
                <Fragment key={`market-block-${market}`}>
                  {parkingMap.get(market) && (
                    <FeeRow
                      label={`Parking ${market}`}
                      suggested={parkingMap.get(market)!.suggested}
                    />
                  )}
                  {kpbMap.get(market) && (
                    <FeeRow
                      label={formatKpbFeeRowLabel(market, locale)}
                      suggested={kpbMap.get(market)!.suggested}
                    />
                  )}
                  {upahTurunMap.get(market) && (
                    <FeeRow
                      label={`Upah Turun ${market}`}
                      suggested={upahTurunMap.get(market)!.suggested}
                    />
                  )}
                </Fragment>
              ))}
              {marketWithAnyRows.length === 0 && (
                <>
                  <FeeRow label="Parking" suggested={voucher.parkingAmt} />
                  <FeeRow label="KPB" suggested={voucher.kpbAmt} />
                  <FeeRow label="Upah Turun" suggested={voucher.upahTurunAmt} />
                </>
              )}
              <FeeRow
                label="Semak Ikan / Fish Check"
                suggested={voucher.fishCheckAmt}
              />
              <FeeRow
                label={
                  breakdown?.upahNaikTongLabel ??
                  "Upah Naik Tong / Crate Loading"
                }
                suggested={upahNaikTongSuggested}
              />
            </>
          )}
          <FeeRow
            label={VOUCHER_PRINT_LABELS.minyakMoto}
            suggested={
              voucher.minyakMotoEnabled ? voucher.minyakMotoAmt : null
            }
          />
          <FeeRow label={VOUCHER_PRINT_LABELS.lainLain} suggested={null} />
          <FeeRow
            label={VOUCHER_PRINT_LABELS.subtotal}
            suggested={suggestedSubtotal}
            bold
          />
        </tbody>
      </table>

      <div className="voucher-print-summary-wrap">
        <table className="voucher-print-summary">
          <tbody>
            <tr>
              <td>{VOUCHER_PRINT_LABELS.duitJalan}</td>
              <td className="text-right voucher-print-handwrite-cell" />
            </tr>
            <tr>
              <td>{VOUCHER_PRINT_LABELS.belanja}</td>
              <td className="text-right voucher-print-handwrite-cell" />
            </tr>
            <tr>
              <td>{VOUCHER_PRINT_LABELS.baki}</td>
              <td className="text-right font-semibold voucher-print-handwrite-cell" />
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
