import {
  formatMyr,
  VOUCHER_LINE_ITEMS,
  type DriverVoucherData,
} from "@/lib/driver-expense/voucher-utils";

interface DriverVoucherPrintProps {
  voucher: DriverVoucherData;
  date: string;
}

export function DriverVoucherPrint({ voucher, date }: DriverVoucherPrintProps) {
  const displayDate = voucher.tripDate || date;

  return (
    <div className="driver-voucher-print-a5 hidden print:block">
      <div className="voucher-print-company">Hai Dee Logistics Co.,Ltd</div>

      <div className="voucher-print-header-grid">
        <div>
          <div>
            <span className="voucher-print-label">Nama</span> {voucher.driverName}
          </div>
          <div>
            <span className="voucher-print-label">No Lorry</span> {voucher.lorry}
          </div>
        </div>
        <div className="voucher-print-header-right">
          <div>
            <span className="voucher-print-label">Voucher No</span>{" "}
            {voucher.voucherNo}
          </div>
          <div>
            <span className="voucher-print-label">Tarikh</span> {displayDate}
          </div>
          <div>
            <span className="voucher-print-label">Trip</span> {voucher.route}
          </div>
        </div>
      </div>

      <table className="voucher-print-table">
        <thead>
          <tr>
            <th>Perkara</th>
            <th className="text-right">系统建议 (RM)</th>
            <th className="text-right">实际 (RM)</th>
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
              <td>Minyak Moto</td>
              <td className="text-right">{formatMyr(voucher.minyakMotoAmt)}</td>
              <td className="text-right">
                {voucher.minyakMotoActual != null
                  ? formatMyr(voucher.minyakMotoActual)
                  : "—"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="voucher-print-summary-wrap">
        <table className="voucher-print-summary">
          <tbody>
            <tr>
              <td>Duit Jalan</td>
              <td className="text-right">
                {voucher.duitJalan != null ? formatMyr(voucher.duitJalan) : "—"}
              </td>
            </tr>
            <tr>
              <td>Belanja</td>
              <td className="text-right">
                {voucher.belanja != null ? formatMyr(voucher.belanja) : "—"}
              </td>
            </tr>
            <tr>
              <td>Baki</td>
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
