"use client";

import { Fragment } from "react";

import {
  formatMyr,
  sumSuggestedAmounts,
  VOUCHER_PRINT_LABELS,
  type DriverVoucherData,
  type VoucherPrintBreakdown,
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

const MARKET_ORDER = ["KL", "MC", "A", "BM", "BM Pindah", "KD"] as const;

interface DriverVoucherPrintAreaProps {
  voucher: DriverVoucherData;
  breakdown: VoucherPrintBreakdown | null;
}

export function DriverVoucherPrintArea({
  voucher,
  breakdown,
}: DriverVoucherPrintAreaProps) {
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
  const suggestedSubtotal = sumSuggestedAmounts({
    chopBorderAmt: voucher.chopBorderAmt,
    parkingAmt: parkingSuggested,
    kpbAmt: kpbSuggested,
    fishCheckAmt: voucher.fishCheckAmt,
    upahTurunAmt: upahTurunSuggested,
    upahNaikTongAmt: upahNaikTongSuggested,
    minyakMotoEnabled: voucher.minyakMotoEnabled,
    minyakMotoAmt: voucher.minyakMotoAmt,
  });

  const bakiClass =
    voucher.baki != null && voucher.baki >= 0
      ? "text-green-700"
      : voucher.baki != null
        ? "text-red-700"
        : "";

  const parkingMap = new Map((breakdown?.parking ?? []).map((row) => [row.market, row]));
  const kpbMap = new Map((breakdown?.kpb ?? []).map((row) => [row.market, row]));
  const upahTurunMap = new Map((breakdown?.upahTurun ?? []).map((row) => [row.market, row]));
  const parkingMarkets = MARKET_ORDER.filter((market) => parkingMap.has(market));
  const kpbMarkets = MARKET_ORDER.filter((market) => kpbMap.has(market));
  const upahTurunMarkets = MARKET_ORDER.filter((market) => upahTurunMap.has(market));
  const marketWithAnyRows = MARKET_ORDER.filter(
    (market) =>
      parkingMap.has(market) || kpbMap.has(market) || upahTurunMap.has(market)
  );

  return (
    <div className="voucher-print-area" aria-hidden="true">
      <div className="voucher-print-company">Hai Dee Logistics Co.,Ltd</div>

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
          <FeeRow
            label="Chop Border"
            suggested={voucher.chopBorderAmt}
            actual={voucher.chopBorderActual}
          />
          {marketWithAnyRows.map((market) => (
            <Fragment key={`market-block-${market}`}>
              {parkingMap.get(market) && (
                <FeeRow
                  label={`Parking ${market}`}
                  suggested={parkingMap.get(market)!.suggested}
                  actual={
                    market === parkingMarkets[parkingMarkets.length - 1]
                      ? voucher.parkingActual
                      : null
                  }
                />
              )}
              {kpbMap.get(market) && (
                <FeeRow
                  label={`KPB ${market}`}
                  suggested={kpbMap.get(market)!.suggested}
                  actual={
                    market === kpbMarkets[kpbMarkets.length - 1]
                      ? voucher.kpbActual
                      : null
                  }
                />
              )}
              {upahTurunMap.get(market) && (
                <FeeRow
                  label={`Upah Turun ${market}`}
                  suggested={upahTurunMap.get(market)!.suggested}
                  actual={
                    market === upahTurunMarkets[upahTurunMarkets.length - 1]
                      ? voucher.upahTurunActual
                      : null
                  }
                />
              )}
            </Fragment>
          ))}
          {marketWithAnyRows.length === 0 && (
            <>
              <FeeRow
                label="Parking"
                suggested={voucher.parkingAmt}
                actual={voucher.parkingActual}
              />
              <FeeRow
                label="KPB"
                suggested={voucher.kpbAmt}
                actual={voucher.kpbActual}
              />
              <FeeRow
                label="Upah Turun"
                suggested={voucher.upahTurunAmt}
                actual={voucher.upahTurunActual}
              />
            </>
          )}
          <FeeRow
            label="Semak Ikan / Fish Check"
            suggested={voucher.fishCheckAmt}
            actual={voucher.fishCheckActual}
          />
          <FeeRow
            label={
              breakdown?.upahNaikTongLabel ??
              "Upah Naik Tong / Crate Loading"
            }
            suggested={
              upahNaikTongSuggested
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
