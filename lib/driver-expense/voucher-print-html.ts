import {
  formatMyr,
  sumSuggestedAmounts,
  VOUCHER_PRINT_LABELS,
  type DriverVoucherData,
  type VoucherPrintBreakdown,
  type VoucherPrintMarketRow,
} from "@/lib/driver-expense/voucher-utils";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAmt(value: number | null): string {
  return value != null ? formatMyr(value) : "—";
}

function buildFeeRow(
  label: string,
  suggested: number | null,
  actual: number | null
): string {
  return `<tr>
    <td>${escapeHtml(label)}</td>
    <td class="right">${formatAmt(suggested)}</td>
    <td class="right">${formatAmt(actual)}</td>
  </tr>`;
}

function buildMarketSplitRows(
  labelPrefix: string,
  rows: VoucherPrintMarketRow[],
  actualTotal: number | null
): string {
  if (rows.length === 0) return "";
  return rows
    .map((row, index) => {
      const isLast = index === rows.length - 1;
      return buildFeeRow(
        `${labelPrefix} ${row.market}`,
        row.suggested,
        isLast ? actualTotal : null
      );
    })
    .join("");
}

export function buildDriverVoucherPrintHtml(
  voucher: DriverVoucherData,
  breakdown?: VoucherPrintBreakdown | null
): string {
  const displayDate = voucher.tripDate;
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

  const parkingRows = breakdown
    ? buildMarketSplitRows("Parking", breakdown.parking, voucher.parkingActual)
    : buildFeeRow("Parking", voucher.parkingAmt, voucher.parkingActual);

  const kpbRows = breakdown
    ? buildMarketSplitRows("KPB", breakdown.kpb, voucher.kpbActual)
    : buildFeeRow("KPB", voucher.kpbAmt, voucher.kpbActual);

  const upahTurunRows = breakdown
    ? buildMarketSplitRows(
        "Upah Turun / Unloading",
        breakdown.upahTurun,
        voucher.upahTurunActual
      )
    : buildFeeRow(
        "Upah Turun / Unloading",
        voucher.upahTurunAmt,
        voucher.upahTurunActual
      );

  const upahNaikTongRow = breakdown
    ? buildFeeRow(
        breakdown.upahNaikTongLabel,
        breakdown.upahNaikTongSuggested,
        voucher.upahNaikTongActual
      )
    : buildFeeRow(
        "Upah Naik Tong / Crate Loading",
        voucher.upahNaikTongAmt,
        voucher.upahNaikTongActual
      );

  const minyakRow = voucher.minyakMotoEnabled
    ? buildFeeRow(
        VOUCHER_PRINT_LABELS.minyakMoto,
        voucher.minyakMotoAmt,
        voucher.minyakMotoActual
      )
    : "";

  const otherRow =
    voucher.otherActual != null
      ? buildFeeRow(VOUCHER_PRINT_LABELS.lainLain, null, voucher.otherActual)
      : "";

  const bakiClass =
    voucher.baki != null && voucher.baki >= 0
      ? "baki-pos"
      : voucher.baki != null
        ? "baki-neg"
        : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Voucher ${escapeHtml(voucher.voucherNo)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 148mm; min-height: 210mm; padding: 10mm; font-size: 11pt; font-family: Arial, sans-serif; color: #111; }
    @page { size: A5 portrait; margin: 0; }
    @media print { body { width: 148mm; } }
    .company { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 14px; }
    .header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 14px; font-size: 10.5pt; line-height: 1.5; }
    .header-right { text-align: right; }
    .label { font-weight: 600; }
    table.fees { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10pt; }
    table.fees th, table.fees td { border: 1px solid #333; padding: 5px 7px; vertical-align: top; }
    table.fees th.right, table.fees td.right { text-align: right; }
    tr.subtotal td { font-weight: bold; border-top: 2px solid #333; }
    .summary-wrap { display: flex; justify-content: flex-end; margin-bottom: 18px; }
    table.summary { border-collapse: collapse; font-size: 10pt; min-width: 50%; }
    table.summary td { border: 1px solid #333; padding: 5px 8px; }
    table.summary td.right { text-align: right; }
    .baki-pos { color: #15803d; font-weight: 600; }
    .baki-neg { color: #b91c1c; font-weight: 600; }
    .signature { margin-top: 22px; font-size: 10pt; }
    .signature-line { margin-top: 32px; border-top: 1px solid #333; width: 58%; }
  </style>
</head>
<body>
  <div class="company">Hai Dee Logistics Co.,Ltd</div>

  <div class="header">
    <div>
      <div><span class="label">${VOUCHER_PRINT_LABELS.nama}</span> ${escapeHtml(voucher.driverName)}</div>
      <div><span class="label">${VOUCHER_PRINT_LABELS.noLorry}</span> ${escapeHtml(voucher.lorry)}</div>
    </div>
    <div class="header-right">
      <div><span class="label">${VOUCHER_PRINT_LABELS.voucherNo}</span> ${escapeHtml(voucher.voucherNo)}</div>
      <div><span class="label">${VOUCHER_PRINT_LABELS.tarikh}</span> ${escapeHtml(displayDate)}</div>
      <div><span class="label">${VOUCHER_PRINT_LABELS.trip}</span> ${escapeHtml(voucher.route)}</div>
    </div>
  </div>

  <table class="fees">
    <thead>
      <tr>
        <th>${VOUCHER_PRINT_LABELS.perkara}</th>
        <th class="right">${VOUCHER_PRINT_LABELS.cadanganRm}</th>
        <th class="right">${VOUCHER_PRINT_LABELS.sebenarRm}</th>
      </tr>
    </thead>
    <tbody>
      ${buildFeeRow("Chop Border", voucher.chopBorderAmt, voucher.chopBorderActual)}
      ${parkingRows}
      ${kpbRows}
      ${buildFeeRow("Semak Ikan / Fish Check", voucher.fishCheckAmt, voucher.fishCheckActual)}
      ${upahTurunRows}
      ${upahNaikTongRow}
      ${minyakRow}
      ${otherRow}
      <tr class="subtotal">
        <td>${VOUCHER_PRINT_LABELS.subtotal}</td>
        <td class="right">${formatMyr(suggestedSubtotal)}</td>
        <td class="right">${formatAmt(voucher.belanja)}</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-wrap">
    <table class="summary">
      <tbody>
        <tr>
          <td>${VOUCHER_PRINT_LABELS.duitJalan}</td>
          <td class="right">${formatAmt(voucher.duitJalan)}</td>
        </tr>
        <tr>
          <td>${VOUCHER_PRINT_LABELS.belanja}</td>
          <td class="right">${formatAmt(voucher.belanja)}</td>
        </tr>
        <tr>
          <td>${VOUCHER_PRINT_LABELS.baki}</td>
          <td class="right ${bakiClass}">${formatAmt(voucher.baki)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="signature">
    <div>Driver Signature / Tandatangan Pemandu</div>
    <div class="signature-line"></div>
  </div>
</body>
</html>`;
}

export async function openDriverVoucherPrintWindow(
  voucher: DriverVoucherData
): Promise<void> {
  let breakdown: VoucherPrintBreakdown | null = null;
  try {
    const res = await fetch(
      `/api/driver-vouchers/print-breakdown?tripId=${encodeURIComponent(voucher.tripId)}`
    );
    if (res.ok) {
      const data = (await res.json()) as { breakdown?: VoucherPrintBreakdown };
      breakdown = data.breakdown ?? null;
    }
  } catch {
    breakdown = null;
  }

  const htmlContent = buildDriverVoucherPrintHtml(voucher, breakdown);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.alert("Please allow pop-ups to print the voucher.");
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
  if (printWindow.document.readyState === "complete") {
    printWindow.print();
  }
}
