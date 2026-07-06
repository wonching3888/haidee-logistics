import type { CrateExportPrefillMember } from "@/lib/crate-export-due-today";
import "./tong-receipt.css";

export interface ReceiptLine {
  tongName: string;
  tongCode?: string;
  quantity: number;
  quantityActual: number;
  shortage: number;
}

export interface ReceiptData {
  kind?: "standard" | "agent" | "pool";
  exportNo: string;
  date: string;
  shipperName: string;
  thVehiclePlate: string;
  lines: ReceiptLine[];
  /** Agent receipt: actual received totals by crate code. */
  actualTotalsByCode?: Record<string, number>;
  /** Agent receipt: live member inbound breakdown (print-time). */
  memberBreakdown?: CrateExportPrefillMember[];
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

function formatQtyByCode(map: Record<string, number>): string {
  return Object.entries(map)
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, qty]) => `${code} ${qty}`)
    .join(" / ");
}

function memberQtySummary(member: CrateExportPrefillMember): string {
  return formatQtyByCode(member.due);
}

function subtotalsByCode(
  members: CrateExportPrefillMember[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const member of members) {
    for (const [code, qty] of Object.entries(member.due)) {
      out[code] = (out[code] ?? 0) + qty;
    }
  }
  return out;
}

function ReceiptHeader() {
  return (
    <div className="receipt-header">
      <div>บริษัท ไฮดี โลจิสติกส์ จำกัด</div>
      <div className="receipt-company-cn">海利物流有限公司</div>
      <div className="receipt-company-en">HAI DEE LOGISTICS CO.,LTD</div>
      <div className="receipt-address">
        38/88 หมู่1 ถ.กาญจนวนิช ต.สำนักขาม อ.สะเดา จ.สงขลา 90320
      </div>
      <div className="receipt-phone">โทร. 098 337 9070 / 092 270 1477</div>
    </div>
  );
}

function AgentExportReceipt({ data }: TongExportReceiptProps) {
  const shipperDisplay = receiptEnglishText(data.shipperName);
  const actualTotals = data.actualTotalsByCode ?? {};
  const totalActual = Object.values(actualTotals).reduce((s, n) => s + n, 0);
  const members = data.memberBreakdown ?? [];
  const memberSubtotals = subtotalsByCode(members);

  return (
    <div className="tong-receipt">
      <ReceiptHeader />

      <div className="receipt-title">
        ใบรับคืนลังเปล่า Empty Crate Receipt
        <span className="receipt-agent-badge">Agent</span>
      </div>

      <div className="receipt-meta">
        <div>
          นาม Agent: <strong>{shipperDisplay}</strong> ({data.thVehiclePlate})
        </div>
        <div>
          วันที่ Date: <strong>{data.date}</strong>
        </div>
        <div>
          No: <strong>{data.exportNo}</strong>
        </div>
      </div>

      <section className="receipt-agent-summary">
        <h4 className="receipt-section-title">实收总数 Actual Received</h4>
        <p className="receipt-agent-totals font-mono">
          {formatQtyByCode(actualTotals) || "—"}
        </p>
      </section>

      {members.length > 0 ? (
        <section className="receipt-agent-members">
          <h4 className="receipt-section-title">
            子顾客明细 Member Breakdown (today inbound)
          </h4>
          <table className="receipt-table receipt-agent-member-table">
            <thead>
              <tr>
                <th>顾客 Member</th>
                <th>来货 Inbound</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.memberId}>
                  <td>{receiptEnglishText(member.label)}</td>
                  <td className="font-mono">{memberQtySummary(member)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="receipt-agent-subtotal">
            <span>小计 Subtotal</span>
            <span className="font-mono">{formatQtyByCode(memberSubtotals)}</span>
          </div>
        </section>
      ) : null}

      <div className="receipt-total">
        总计 Total: {totalActual} ลัง
      </div>

      <div className="receipt-signatures">
        <div>ผู้รับ Receiver _______________</div>
        <div>ผู้ส่ง Sender _______________</div>
      </div>
    </div>
  );
}

function PoolExportReceipt({ data }: TongExportReceiptProps) {
  const totalActual = data.lines.reduce((s, l) => s + l.quantityActual, 0);
  const shipperDisplay = receiptEnglishText(data.shipperName);

  return (
    <div className="tong-receipt">
      <ReceiptHeader />

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
            <th>桶型 Crate</th>
            <th>จำนวนเงิน Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={line.tongCode ?? i}>
              <td className="text-center">{line.quantityActual}</td>
              <td className="font-mono">
                {line.tongCode ?? receiptEnglishText(line.tongName)}
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
        รวมเงิน Total: - &nbsp;&nbsp; {totalActual} ลัง
      </div>

      <div className="receipt-signatures">
        <div>ผู้รับ Receiver _______________</div>
        <div>ผู้ส่ง Sender _______________</div>
      </div>
    </div>
  );
}

function StandardExportReceipt({ data }: TongExportReceiptProps) {
  const totalActual = data.lines.reduce((s, l) => s + l.quantityActual, 0);
  const shipperDisplay = receiptEnglishText(data.shipperName);

  return (
    <div className="tong-receipt">
      <ReceiptHeader />

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

export function TongExportReceipt({ data }: TongExportReceiptProps) {
  if (data.kind === "agent") {
    return <AgentExportReceipt data={data} />;
  }
  if (data.kind === "pool") {
    return <PoolExportReceipt data={data} />;
  }
  return <StandardExportReceipt data={data} />;
}
