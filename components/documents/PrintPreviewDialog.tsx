"use client";

import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PrintPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  documentTitle: string;
  children: React.ReactNode;
}

export function PrintPreviewDialog({
  open,
  onClose,
  title,
  documentTitle,
  children,
}: PrintPreviewDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-haidee-border px-4 py-3">
          <DialogTitle className="text-haidee-text">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrint()}
              className="gap-1"
            >
              <Printer className="h-4 w-4" />
              打印 Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrint()}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              下载 PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto bg-gray-100 p-6">
          <div
            ref={contentRef}
            className="mx-auto max-w-[210mm] bg-white p-8 shadow-md"
          >
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
