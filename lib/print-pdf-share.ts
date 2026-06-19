/**
 * Prototype: HTML → PDF blob + Web Share API (client-only).
 * Uses html2canvas + jsPDF — rasterized pages, not selectable text.
 */

import { prepareHtml2CanvasClone, runWithHtml2CanvasCompat } from "@/lib/html2canvas-color-compat";

export interface PdfFromElementOptions {
  fileName?: string;
  /** html2canvas scale; 2 is a reasonable mobile/desktop balance */
  scale?: number;
}

export interface PdfSharePayload {
  fileName: string;
  title?: string;
  text?: string;
}

export type PdfShareResult =
  | { method: "web-share-file"; message: string }
  | { method: "web-share-text"; message: string }
  | { method: "download"; message: string }
  | { method: "cancelled"; message: string };

export interface ShareCapabilityProbe {
  hasNavigatorShare: boolean;
  canShareFiles: boolean;
  canShareText: boolean;
  userAgent: string;
  notes: string[];
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_") || "document.pdf";
}

export function probeShareCapability(): ShareCapabilityProbe {
  const notes: string[] = [];
  const hasNavigatorShare = typeof navigator !== "undefined" && "share" in navigator;

  let canShareFiles = false;
  let canShareText = false;

  if (hasNavigatorShare && typeof navigator.canShare === "function") {
    try {
      const dummyPdf = new File([new Blob(["%PDF-1.4"], { type: "application/pdf" })], "probe.pdf", {
        type: "application/pdf",
      });
      canShareFiles = navigator.canShare({ files: [dummyPdf] });
    } catch {
      notes.push("canShare(files) threw — file share likely unsupported");
    }
    try {
      canShareText = navigator.canShare({ title: "probe", text: "probe" });
    } catch {
      notes.push("canShare(text) threw");
    }
  } else if (hasNavigatorShare) {
    notes.push("navigator.share exists but canShare is missing (older Web Share)");
    canShareText = true;
  }

  if (!hasNavigatorShare) {
    notes.push("Web Share API unavailable (desktop browser or insecure context)");
  }

  return {
    hasNavigatorShare,
    canShareFiles,
    canShareText,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    notes,
  };
}

export async function renderElementToPdfBlob(
  element: HTMLElement,
  options?: PdfFromElementOptions
): Promise<{ blob: Blob; fileName: string }> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const scale = options?.scale ?? 2;
  const canvas = await runWithHtml2CanvasCompat(() =>
    html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc, clonedElement) => {
        if (clonedElement instanceof HTMLElement) {
          prepareHtml2CanvasClone(clonedDoc, element, clonedElement);
        } else {
          prepareHtml2CanvasClone(clonedDoc, element, element);
        }
      },
    })
  );

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let offsetY = 0;
  let remaining = imgHeight;

  pdf.addImage(imgData, "JPEG", 0, offsetY, imgWidth, imgHeight);
  remaining -= pageHeight;

  while (remaining > 0) {
    offsetY = remaining - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, offsetY, imgWidth, imgHeight);
    remaining -= pageHeight;
  }

  const blob = pdf.output("blob");
  const fileName = sanitizeFileName(options?.fileName ?? "document.pdf");

  return { blob, fileName };
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function sharePdfBlob(
  blob: Blob,
  fileName: string,
  payload?: Omit<PdfSharePayload, "fileName">
): Promise<PdfShareResult> {
  const file = new File([blob], fileName, { type: "application/pdf" });

  if (typeof navigator.share === "function") {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: payload?.title ?? fileName,
          text: payload?.text,
        });
        return {
          method: "web-share-file",
          message: "已通过系统分享面板分享 PDF（可选 WhatsApp）",
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return { method: "cancelled", message: "已取消分享" };
        }
        // fall through to download
      }
    }

    if (
      payload?.text &&
      (!navigator.canShare || navigator.canShare({ text: payload.text, title: payload.title }))
    ) {
      try {
        await navigator.share({
          title: payload.title ?? fileName,
          text: payload.text,
        });
        return {
          method: "web-share-text",
          message: "当前设备不支持分享 PDF 文件，已改为分享文字摘要",
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return { method: "cancelled", message: "已取消分享" };
        }
      }
    }
  }

  triggerBlobDownload(blob, fileName);
  return {
    method: "download",
    message:
      "此浏览器不支持直接分享 PDF 文件，已触发下载。请在下载通知/文件 App 中点分享，或换用手机 Safari/Chrome 重试。",
  };
}

export async function shareElementAsPdf(
  element: HTMLElement,
  payload: PdfSharePayload
): Promise<PdfShareResult> {
  const { blob, fileName } = await renderElementToPdfBlob(element, {
    fileName: payload.fileName,
  });
  return sharePdfBlob(blob, fileName, payload);
}
