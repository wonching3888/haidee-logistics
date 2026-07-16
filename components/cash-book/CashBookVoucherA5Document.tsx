"use client";

import type { ReactNode } from "react";
import {
  HAIDEE_VOUCHER_PRINT_ADDRESS_LINES,
  HAIDEE_VOUCHER_PRINT_TAX_ID,
} from "@/lib/constants/haidee-company-details";
import {
  padVoucherPrintSlots,
  paginateVoucherPrintLines,
  VOUCHER_PRINT_LINES_PER_PAGE,
} from "@/lib/cash-book/voucher-print-pages";

function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export type CashBookVoucherPrintLine = {
  id: string;
  particulars: string | null;
  amount: number;
};

export type CashBookVoucherPrintLabels = {
  title: string;
  voucherNo: string;
  date: string;
  party: string;
  colParticulars: string;
  colAmount: string;
  total: string;
  amountInWords: string;
  notes?: string;
};

type SignatureColumn = {
  label: string;
  name: string;
};

export function CashBookVoucherA5Document({
  labels,
  voucherNo,
  voucherDateDisplay,
  partyValue,
  book,
  metaExtra,
  lines,
  totalAmount,
  amountWords,
  signatures,
}: {
  labels: CashBookVoucherPrintLabels;
  voucherNo: string;
  voucherDateDisplay: string;
  partyValue: string;
  book: string;
  metaExtra?: ReactNode;
  lines: CashBookVoucherPrintLine[];
  totalAmount: number;
  amountWords: string;
  signatures: SignatureColumn[];
}) {
  const pages = paginateVoucherPrintLines(lines, VOUCHER_PRINT_LINES_PER_PAGE);
  const pageCount = pages.length;

  return (
    <div className="payment-voucher-print-stack">
      {pages.map((pageLines, pageIndex) => {
        const isLast = pageIndex === pageCount - 1;
        const slots = padVoucherPrintSlots(
          pageLines,
          VOUCHER_PRINT_LINES_PER_PAGE
        );
        const pageNum = pageIndex + 1;
        return (
          <div
            key={`page-${pageNum}`}
            className={[
              "document-print",
              "payment-voucher-print",
              "payment-voucher-print-page",
              isLast ? "is-last-page" : "",
              "rounded-lg border bg-white p-6",
            ]
              .filter(Boolean)
              .join(" ")}
            data-voucher-print-page={pageNum}
            data-voucher-print-page-count={pageCount}
            data-voucher-print-is-last={isLast ? "1" : "0"}
            data-voucher-print-orientation="landscape"
          >
            <header className="payment-voucher-topband">
              <div className="payment-voucher-topband-company">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="haidee-invoice-letterhead-logo payment-voucher-topband-logo"
                />
                <div className="payment-voucher-topband-company-text">
                  <div className="haidee-invoice-letterhead-name-th">
                    บริษัท ไฮดี โลจิสติกส์ จำกัด
                  </div>
                  <div className="haidee-invoice-letterhead-name-en">
                    HAI DEE LOGISTICS CO., LTD.
                  </div>
                  {HAIDEE_VOUCHER_PRINT_ADDRESS_LINES.map((line) => (
                    <div
                      key={line}
                      className="haidee-invoice-letterhead-detail"
                    >
                      {line}
                    </div>
                  ))}
                  <div className="haidee-invoice-letterhead-detail">
                    {HAIDEE_VOUCHER_PRINT_TAX_ID}
                  </div>
                </div>
              </div>

              <h1 className="payment-voucher-title">
                <span>{labels.title}</span>
              </h1>

              <div className="payment-voucher-topband-right">
                <p>
                  <span className="font-medium">{labels.voucherNo}</span>
                </p>
                <p className="font-mono payment-voucher-topband-voucher-no">
                  {voucherNo}
                </p>
                {pageCount > 1 ? (
                  <p className="payment-voucher-page-label">
                    หน้า {pageNum}/{pageCount}
                  </p>
                ) : null}
              </div>
            </header>

            <div className="payment-voucher-meta">
              <p>
                <span className="font-medium">{labels.date}:</span>{" "}
                {voucherDateDisplay}
              </p>
              <p className="payment-voucher-meta-party">
                <span className="font-medium">{labels.party}:</span> {partyValue}
              </p>
              {metaExtra}
            </div>

            <table className="payment-voucher-table">
              <thead>
                <tr>
                  <th className="text-left">{labels.colParticulars}</th>
                  <th className="payment-voucher-amount-col text-right whitespace-nowrap">
                    {labels.colAmount} ({book})
                  </th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, slotIndex) => (
                  <tr
                    key={`slot-${pageNum}-${slotIndex}`}
                    className="payment-voucher-slot-row"
                    data-empty={slot ? "0" : "1"}
                  >
                    <td className="payment-voucher-slot-particulars">
                      {slot?.particulars?.trim() ? slot.particulars : "\u00A0"}
                    </td>
                    <td className="payment-voucher-amount-col text-right font-mono whitespace-nowrap">
                      {slot ? money(slot.amount) : "\u00A0"}
                    </td>
                  </tr>
                ))}
                {isLast ? (
                  <tr className="payment-voucher-total-row font-bold">
                    <td className="text-right">{labels.total}</td>
                    <td className="payment-voucher-amount-col text-right font-mono">
                      {money(totalAmount)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {isLast ? (
              <>
                <div className="payment-voucher-words">
                  <span className="font-medium payment-voucher-words-label">
                    {labels.amountInWords}:
                  </span>{" "}
                  <span className="payment-voucher-amount-words">
                    {amountWords}
                  </span>
                </div>
                <div
                  className="payment-voucher-signatures"
                  style={{
                    gridTemplateColumns: `repeat(${signatures.length}, minmax(0, 1fr))`,
                  }}
                >
                  {signatures.map((sig) => (
                    <div key={sig.label}>
                      <div className="payment-voucher-sig-line" />
                      <p className="payment-voucher-sig-label">{sig.label}</p>
                      <p className="payment-voucher-sig-name">{sig.name}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="payment-voucher-continued" aria-hidden="true">
                — ต่อหน้าถัดไป / continued —
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
