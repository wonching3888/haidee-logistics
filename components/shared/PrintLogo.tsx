import type { ReactNode } from "react";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";

export const DEFAULT_PRINT_LETTERHEAD = {
  nameZh: "海利物流有限公司",
  nameEn: "HAI DEE LOGISTICS CO., LTD.",
} as const;

export function PrintLetterhead({
  nameZh = DEFAULT_PRINT_LETTERHEAD.nameZh,
  nameEn = DEFAULT_PRINT_LETTERHEAD.nameEn,
  className,
}: {
  nameZh?: string;
  nameEn?: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        marginBottom: "8px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          height: "56px",
          width: "auto",
          mixBlendMode: "multiply",
        }}
      />
      <div>
        <div style={{ fontSize: "20px", fontWeight: "bold" }}>{nameZh}</div>
        <div style={{ fontSize: "14px" }}>{nameEn}</div>
      </div>
    </div>
  );
}

/** WTL Tax Invoice letterhead: logo left, company details stacked on the right. */
export function WtlExpressInvoiceLetterhead({ className }: { className?: string }) {
  const company = INVOICE_COMPANY_HEADERS.wtl;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        marginBottom: "8px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          height: "56px",
          width: "auto",
          flexShrink: 0,
          mixBlendMode: "multiply",
        }}
      />
      <div className="wtl-invoice-letterhead-text">
        <div className="wtl-invoice-letterhead-name">{company.nameZh}</div>
        <div>{company.addressLine1}</div>
        <div>{company.addressLine2}</div>
        <div>{company.phone}</div>
        <div>{company.sstRegistrationNo}</div>
      </div>
    </div>
  );
}

/** @deprecated Use PrintLetterhead */
export function PrintLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      style={{
        height: "56px",
        width: "auto",
        mixBlendMode: "multiply",
      }}
      alt="Logo"
    />
  );
}

/** @deprecated Use PrintLetterhead */
export function PrintCompanyHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <PrintLetterhead
      className={className}
      nameZh={DEFAULT_PRINT_LETTERHEAD.nameZh}
      nameEn={String(children)}
    />
  );
}
