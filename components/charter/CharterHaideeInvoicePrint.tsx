import type { CharterInvoiceData } from "@/lib/charter-invoice";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import {
  HaideeInvoiceDescriptionAmountTable,
  HaideeInvoiceGrandTotal,
  HaideeInvoiceMetaBlocks,
  HaideeInvoicePrintDocument,
  HaideeInvoicePrintHeader,
  HaideeInvoiceSignatureRow,
} from "@/components/documents/HaideeInvoicePrintLayout";

/** Charter HAIDEE invoice letterhead — matches TongExportReceipt company block. */
const CHARTER_HAIDEE_LETTERHEAD = {
  nameTh: "บริษัท ไฮดี โลจิสติกส์ จำกัด",
  address: "38/88 หมู่1 ถ.กาญจนวนิช ต.สำนักขาม อ.สะเดา จ.สงขลา 90320",
  phone: "โทร. 098 337 9070 / 092 270 1477",
} as const;

interface CharterHaideeInvoicePrintProps {
  data: CharterInvoiceData;
}

export function CharterHaideeInvoicePrint({ data }: CharterHaideeInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS.haidee;

  return (
    <HaideeInvoicePrintDocument framed>
      <HaideeInvoicePrintHeader
        nameZh={company.nameZh}
        nameEn={company.nameEn}
        nameTh={CHARTER_HAIDEE_LETTERHEAD.nameTh}
        addressLines={[CHARTER_HAIDEE_LETTERHEAD.address]}
        phone={CHARTER_HAIDEE_LETTERHEAD.phone}
        subtitle={`${data.billToDisplayLabel} · ${data.dateLabel} · ${data.currency}`}
      />

      <HaideeInvoiceMetaBlocks
        billToLabel="Bill To"
        billToName={data.billTo.name}
        billToCode={data.billTo.code}
        billToDetail={
          data.billTo.location ? (
            <div className="whitespace-pre-line text-sm text-haidee-muted">
              {data.billTo.location}
            </div>
          ) : undefined
        }
        info={
          <>
            <div>
              <strong>包车单号 Charter No:</strong> {data.charterNo}
            </div>
            <div>
              <strong>日期 Date:</strong> {data.dateLabel}
            </div>
            <div>
              <strong>币种 Currency:</strong> {data.currency}
            </div>
            <div>
              <strong>车牌 Truck:</strong> {data.truckPlate}
            </div>
            <div>
              <strong>货类 Cargo:</strong> {data.cargoTypeLabel}
            </div>
          </>
        }
      />

      <HaideeInvoiceDescriptionAmountTable
        lines={data.lines}
        sectionTitle="包车费用 Charter Charges"
        amountHeader={`Amount (${data.currency})`}
      />

      <HaideeInvoiceGrandTotal
        amountMyr={data.grandTotalMyr}
        currency={data.currency}
      />

      <HaideeInvoiceSignatureRow />
    </HaideeInvoicePrintDocument>
  );
}
