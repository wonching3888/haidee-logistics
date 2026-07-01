import type { ReactNode } from "react";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";

export const DEFAULT_PRINT_LETTERHEAD = {
  nameZh: "海利物流有限公司",
  nameEn: "HAI DEE LOGISTICS CO., LTD.",
} as const;

export function PrintLetterhead({
  nameZh = DEFAULT_PRINT_LETTERHEAD.nameZh,
  nameEn = DEFAULT_PRINT_LETTERHEAD.nameEn,
  nameTh,
  addressLines,
  phone,
  taxId,
  className,
}: {
  nameZh?: string;
  nameEn?: string;
  nameTh?: string;
  addressLines?: string[];
  phone?: string;
  taxId?: string;
  className?: string;
}) {
  const useExtendedLetterhead = Boolean(
    nameTh ||
      (addressLines && addressLines.length > 0) ||
      phone ||
      taxId
  );

  if (useExtendedLetterhead) {
    return (
      <div
        className={
          className
            ? `haidee-invoice-letterhead ${className}`
            : "haidee-invoice-letterhead"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Logo"
          className="haidee-invoice-letterhead-logo"
        />
        <div className="haidee-invoice-letterhead-text">
          {nameTh ? (
            <div className="haidee-invoice-letterhead-line haidee-invoice-letterhead-name-th">
              {nameTh}
            </div>
          ) : null}
          <div className="haidee-invoice-letterhead-line haidee-invoice-letterhead-name">
            {nameZh}
          </div>
          <div className="haidee-invoice-letterhead-line haidee-invoice-letterhead-name-en">
            {nameEn}
          </div>
          {addressLines?.map((line) => (
            <div
              key={line}
              className="haidee-invoice-letterhead-line haidee-invoice-letterhead-detail"
            >
              {line}
            </div>
          ))}
          {phone ? (
            <div className="haidee-invoice-letterhead-line haidee-invoice-letterhead-detail">
              {phone}
            </div>
          ) : null}
          {taxId ? (
            <div className="haidee-invoice-letterhead-line haidee-invoice-letterhead-detail">
              {taxId}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

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
    <div className={className ? `wtl-invoice-letterhead ${className}` : "wtl-invoice-letterhead"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Logo" className="wtl-invoice-letterhead-logo" />
      <div className="wtl-invoice-letterhead-text">
        <div className="wtl-invoice-letterhead-line wtl-invoice-letterhead-name">
          {company.nameZh}
        </div>
        <div className="wtl-invoice-letterhead-line">{company.addressLine1}</div>
        <div className="wtl-invoice-letterhead-line">{company.addressLine2}</div>
        <div className="wtl-invoice-letterhead-line">{company.phone}</div>
        <div className="wtl-invoice-letterhead-line">{company.sstRegistrationNo}</div>
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
