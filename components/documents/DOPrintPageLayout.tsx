"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DOPrintPageLayoutProps {
  title: string;
  documentTitle: string;
  children: React.ReactNode;
}

export function DOPrintPageLayout({
  title,
  documentTitle,
  children,
}: DOPrintPageLayoutProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
  });

  return (
    <div className="do-print-page space-y-4">
      <div className="do-print-toolbar flex flex-wrap items-center justify-between gap-3 rounded-xl border border-haidee-border bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-haidee-text">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            返回 Back
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePrint()}
            className="gap-1"
          >
            <Printer className="h-4 w-4" />
            打印 Print
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePrint()}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            下载 PDF
          </Button>
        </div>
      </div>

      <div className="do-print-surface rounded-xl border border-haidee-border bg-gray-100 p-4 sm:p-6">
        <div
          ref={contentRef}
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
