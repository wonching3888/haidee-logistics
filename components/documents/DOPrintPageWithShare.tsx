"use client";

import { useCallback, useState, type ReactNode } from "react";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
import { PrintPdfSharePrototype } from "@/components/documents/PrintPdfSharePrototype";
import type { PdfSharePayload } from "@/lib/print-pdf-share";

interface DOPrintPageWithShareProps {
  title: string;
  documentTitle: string;
  backHref?: string;
  sharePayload: PdfSharePayload;
  sectionSelector?: string;
  activeColumnCount?: number;
  children: ReactNode;
}

/**
 * Print layout + PDF share toolbar. Import only on routes that need sharing
 * so html2canvas/jsPDF stay out of other bundles.
 */
export function DOPrintPageWithShare({
  title,
  documentTitle,
  backHref,
  sharePayload,
  sectionSelector,
  activeColumnCount,
  children,
}: DOPrintPageWithShareProps) {
  const [printContentEl, setPrintContentEl] = useState<HTMLDivElement | null>(
    null
  );

  const handlePrintContentMount = useCallback((element: HTMLDivElement | null) => {
    setPrintContentEl(element);
  }, []);

  return (
    <DOPrintPageLayout
      title={title}
      documentTitle={documentTitle}
      backHref={backHref}
      onPrintContentMount={handlePrintContentMount}
      toolbarExtra={
        <PrintPdfSharePrototype
          getContentElement={() => printContentEl}
          payload={sharePayload}
          sectionSelector={sectionSelector}
          activeColumnCount={activeColumnCount}
        />
      }
    >
      {children}
    </DOPrintPageLayout>
  );
}
