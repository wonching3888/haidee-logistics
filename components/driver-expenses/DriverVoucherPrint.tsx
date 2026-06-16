import {
  formatMyr,
  sumSuggestedAmounts,
  VOUCHER_LABELS,
  VOUCHER_LINE_ITEMS,
  type DriverVoucherData,
} from "@/lib/driver-expense/voucher-utils";

interface DriverVoucherPrintProps {
  voucher: DriverVoucherData;
  date: string;
}

export function DriverVoucherPrint({ voucher, date }: DriverVoucherPrintProps) {
  const displayDate = voucher.tripDate || date;
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

  return (
    <div className="driver-voucher-print-a5 hidden print:block">
      <div className="voucher-print-company">Hai Dee Logistics Co.,Ltd</div>

      <div className="voucher-print-header-grid">
        <div>
          <div>
            <span className="voucher-print-label">{VOUCHER_LABELS.nama}</span>{" "}
            {voucher.driverName}
          </div>
          <div>
            <span className="voucher-print-label">{VOUCHER_LABELS.noLorry}</span>{" "}
            {voucher.lorry}
          </div>
        </div>
        <div className="voucher-print-header-right">
          <div>
            <span className="voucher-print-label">{VOUCHER_LABELS.voucherNo}</span>{" "}
            {voucher.voucherNo}
          </div>
          <div>
            <span className="voucher-print-label">{VOUCHER_LABELS.tarikh}</span>{" "}
            {displayDate}
          </div>
          <div>
            <span className="voucher-print-label">{VOUCHER_LABELS.trip}</span>{" "}
            {voucher.route}
          </div>
        </div>
      </div>

      <table className="voucher-print-table">
        <thead>
          <tr>
            <th>{VOUCHER_LABELS.perkara}</th>
            <th className="text-right">{VOUCHER_LABELS.cadanganRm}</th>
            <th className="text-right">{VOUCHER_LABELS.sebenarRm}</th>
          </tr>
        </thead>
        <tbody>
          {VOUCHER_LINE_ITEMS.map(({ label, amtKey, actualKey }) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="text-right">
                {voucher[amtKey] != null ? formatMyr(voucher[amtKey]!) : "—"}
              </td>
              <td className="text-right">
                {voucher[actualKey] != null
                  ? formatMyr(voucher[actualKey]!)
                  : "—"}
              </td>
            </tr>
          ))}
          {voucher.minyakMotoEnabled && (
            <tr>
              <td>{VOUCHER_LABELS.minyakMoto}</td>
              <td className="text-right">{formatMyr(voucher.minyakMotoAmt)}</td>
              <td className="text-right">
                {voucher.minyakMotoActual != null
                  ? formatMyr(voucher.minyakMotoActual)
                  : "—"}
              </td>
            </tr>
          )}
          <tr className="voucher-print-subtotal-row">
            <td className="font-bold">{VOUCHER_LABELS.subtotal}</td>
            <td className="text-right font-bold font-mono">
              {formatMyr(suggestedSubtotal)}
            </td>
            <td className="text-right font-bold font-mono">
              {voucher.belanja != null ? formatMyr(voucher.belanja) : "—"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="voucher-print-summary-wrap">
        <table className="voucher-print-summary">
          <tbody>
            <tr>
              <td>{VOUCHER_LABELS.duitJalan}</td>
              <td className="text-right">
                {voucher.duitJalan != null ? formatMyr(voucher.duitJalan) : "—"}
              </td>
            </tr>
            <tr>
              <td>{VOUCHER_LABELS.belanja}</td>
              <td className="text-right">
                {voucher.belanja != null ? formatMyr(voucher.belanja) : "—"}
              </td>
            </tr>
            <tr>
              <td>{VOUCHER_LABELS.baki}</td>
              <td
                className={`text-right font-semibold ${
                  voucher.baki != null && voucher.baki >= 0
                    ? "text-green-700"
                    : voucher.baki != null
                      ? "text-red-700"
                      : ""
                }`}
              >
                {voucher.baki != null ? formatMyr(voucher.baki) : "—"}
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
