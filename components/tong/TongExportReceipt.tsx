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

export function TongExportReceipt({ data }: TongExportReceiptProps) {
  const totalActual = data.lines.reduce((s, l) => s + l.quantityActual, 0);

  return (
    <div className="tong-receipt">
      <div className="receipt-header">
        <div className="receipt-header-left">
          <div>เลขที่ {data.exportNo}</div>
        </div>
        <div className="receipt-header-right">
          <div>บริษัท ไฮดี โลจิสติกส์ จำกัด</div>
          <div className="receipt-company-cn">海利物流有限公司</div>
          <div className="receipt-company-en">HAI DEE LOGISTICS CO.,LTD</div>
          <div className="receipt-address">
            99/9 หมู่ 4 ต.สำโรงเหนือ อ.เมืองสมุทรปราการ จ.สมุทรปราการ 10270
          </div>
          <div>โทร. 092-2701477, 098-3379070</div>
        </div>
      </div>

      <div className="receipt-title">ใบรับคืนถังเปล่า Empty Crate Receipt</div>

      <div className="receipt-meta">
        <div>
          นาม: <strong>{data.shipperName}</strong> ({data.thVehiclePlate})
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
          {data.lines.map((line, i) => (
            <tr key={i}>
              <td className="text-center">{line.quantityActual}</td>
              <td>
                {data.date} ส่ง {line.tongName} {line.quantityActual} 桶
                {line.shortage > 0 && ` (欠 ${line.shortage})`}
              </td>
              <td className="text-center">-</td>
            </tr>
          ))}
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
        รวมเงิน Total: - &nbsp;&nbsp; 合计 {totalActual} 桶
      </div>

      <div className="receipt-signatures">
        <div>ผู้รับ Receiver _______________</div>
        <div>ผู้ส่ง Sender _______________</div>
      </div>
    </div>
  );
}
