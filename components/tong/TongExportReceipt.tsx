import "./tong-receipt.css";

export interface ReceiptData {
  exportNo: string;
  date: string;
  shipperName: string;
  thVehiclePlate: string;
  lines: {
    tongName: string;
    quantity: number;
    quantityActual: number;
    shortage: number;
  }[];
}

interface TongExportReceiptProps {
  data: ReceiptData;
}

/** Receipt-only: strip bilingual location prefixes; do not touch shared constants. */
const RECEIPT_LOCATION_CN_TO_EN: Record<string, string> = {
  宋卡: "SONGKHLA",
  北大年: "PATTANI",
  沙道: "SADAO",
};

const CJK_PATTERN = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+/g;

function receiptEnglishText(value: string): string {
  let text = value.trim();
  if (!text) return text;

  for (const [cn, en] of Object.entries(RECEIPT_LOCATION_CN_TO_EN)) {
    text = text.replace(new RegExp(`${cn}\\s*${en}`, "gi"), en);
    text = text.replace(new RegExp(`${cn}(?=\\s|$)`, "g"), "");
  }

  text = text.replace(CJK_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text || value.trim();
}

export function TongExportReceipt({ data }: TongExportReceiptProps) {
  const totalActual = data.lines.reduce((s, l) => s + l.quantityActual, 0);
  const shipperDisplay = receiptEnglishText(data.shipperName);

  return (
    <div className="tong-receipt">
      <div className="receipt-header">
        <div>บริษัท ไฮดี โลจิสติกส์ จำกัด</div>
        <div className="receipt-company-cn">海利物流有限公司</div>
        <div className="receipt-company-en">HAI DEE LOGISTICS CO.,LTD</div>
        <div className="receipt-address">
          38/88 หมู่1 ถ.กาญจนวนิช ต.สำนักขาม อ.สะเดา จ.สงขลา 90320
        </div>
        <div className="receipt-phone">โทร. 098 337 9070 / 092 270 1477</div>
      </div>

      <div className="receipt-title">ใบรับคืนลังเปล่า Empty Crate Receipt</div>

      <div className="receipt-meta">
        <div>
          นาม: <strong>{shipperDisplay}</strong> ({data.thVehiclePlate})
        </div>
        <div>
          วันที่ Date: <strong>{data.date}</strong>
        </div>
        <div>
          No: <strong>{data.exportNo}</strong>
        </div>
      </div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>จำนวน Qty</th>
            <th>รายละเอียด Details</th>
            <th>จำนวนเงิน Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => {
            const tongDisplay = receiptEnglishText(line.tongName);
            return (
              <tr key={i}>
                <td className="text-center">{line.quantityActual}</td>
                <td>
                  {data.date} ส่ง {tongDisplay} {line.quantityActual} ลัง
                  {line.shortage > 0 && ` (Short ${line.shortage})`}
                </td>
                <td className="text-center">-</td>
              </tr>
            );
          })}
          {data.lines.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center">
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="receipt-total">
        รวมเงิน Total: - &nbsp;&nbsp; {totalActual} ลัง
      </div>

      <div className="receipt-signatures">
        <div>ผู้รับ Receiver _______________</div>
        <div>ผู้ส่ง Sender _______________</div>
      </div>
    </div>
  );
}
