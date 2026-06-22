"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";

interface DOPrintPageLayoutProps {
  title: string;
  documentTitle: string;
  /** When set, navigates here instead of browser history back (preserves list filters via query params). */
  backHref?: string;
  children: React.ReactNode;
  /** Optional slot rendered in the toolbar (e.g. partner-trip PDF share prototype). */
  toolbarExtra?: React.ReactNode;
  /** Notifies parent when the printable content root is mounted (for share prototype only). */
  onPrintContentMount?: (element: HTMLDivElement | null) => void;
}

export function DOPrintPageLayout({
  title,
  documentTitle,
  backHref,
  children,
  toolbarExtra,
  onPrintContentMount,
}: DOPrintPageLayoutProps) {
  const router = useRouter();
  const { t } = useT();

  function handleBack() {
    if (backHref) {
      router.push(backHref);
      return;
    }
    router.back();
  }
  const contentRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = useReactToPrint({
    contentRef: contentRef as React.RefObject<HTMLDivElement>,
    documentTitle,
  });

  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      onPrintContentMount?.(node);
    },
    [onPrintContentMount]
  );

  return (
    <div className="do-print-page space-y-4">
      <div className="do-print-toolbar flex flex-wrap items-center justify-between gap-3 rounded-xl border border-haidee-border bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-haidee-text">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handlePrint()}
            className="gap-1"
          >
            <Printer className="h-4 w-4" />
            {t("common.print")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handlePrint()}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            {t("common.downloadPdf")}
          </Button>
          {toolbarExtra}
        </div>
      </div>

      <div className="do-print-surface rounded-xl border border-haidee-border bg-gray-100 p-4 sm:p-6">
        <div
          ref={setContentRef}
          className="mx-auto max-w-[210mm] bg-white p-6 shadow-md sm:p-8"
        >
          {children}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .do-print-toolbar {
            display: none !important;
          }
          .do-print-surface {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
          .do-print-page > .do-print-surface > div {
            box-shadow: none !important;
            max-width: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
