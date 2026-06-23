/**
 * Prototype: HTML → PDF blob + Web Share API (client-only).
 * Uses html2canvas + jsPDF — rasterized pages, not selectable text.
 */

import {
  measureElementCaptureExtents,
  prepareHtml2CanvasClone,
  runWithHtml2CanvasCompat,
  withKlMcPrintPdfCaptureLayout,
  type Html2CanvasCloneOptions,
} from "@/lib/html2canvas-color-compat";

export interface PdfFromElementOptions {
  fileName?: string;
  /** html2canvas scale; 2 is a reasonable mobile/desktop balance */
  scale?: number;
  /**
   * Expand wide matrix tables to full intrinsic width before capture (Daily Record).
   * Other print pages leave this false to preserve existing capture behavior.
   */
  captureFullContentWidth?: boolean;
  wideTableSelector?: string;
  /** When true, use landscape if activeDepotCount ≥ threshold or content width > px */
  autoLandscape?: boolean;
  activeDepotCount?: number;
  landscapeWidthThresholdPx?: number;
  minDepotCountForLandscape?: number;
  minPdfFontPt?: number;
  orientation?: "portrait" | "landscape";
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
  | { method: "unsupported"; message: string }
  | { method: "cancelled"; message: string };

export interface ShareCapabilityProbe {
  hasNavigatorShare: boolean;
  canShareFiles: boolean;
  canShareText: boolean;
  userAgent: string;
  notes: string[];
}

const DEFAULT_LANDSCAPE_WIDTH_THRESHOLD_PX = 900;
const DEFAULT_MIN_DEPOT_COUNT_FOR_LANDSCAPE = 7;
const DEFAULT_MIN_PDF_FONT_PT = 9;

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_") || "document.pdf";
}

async function waitForDocumentFonts() {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

function addCanvasImageToPdfPages(
  pdf: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  imgData: string,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number
) {
  const renderWidth = pageWidth;
  const renderHeight = (canvas.height * renderWidth) / canvas.width;

  if (renderHeight <= pageHeight + 0.5) {
    pdf.addImage(imgData, "JPEG", 0, 0, renderWidth, renderHeight);
    return;
  }

  let heightLeft = renderHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, renderWidth, renderHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0.5) {
    position = heightLeft - renderHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, renderWidth, renderHeight);
    heightLeft -= pageHeight;
  }
}

export function resolvePdfOrientation(
  options: PdfFromElementOptions | undefined,
  contentWidthPx: number
): "portrait" | "landscape" {
  if (options?.orientation) {
    return options.orientation;
  }
  if (!options?.autoLandscape) {
    return "portrait";
  }

  const widthThreshold =
    options.landscapeWidthThresholdPx ?? DEFAULT_LANDSCAPE_WIDTH_THRESHOLD_PX;
  const depotThreshold =
    options.minDepotCountForLandscape ?? DEFAULT_MIN_DEPOT_COUNT_FOR_LANDSCAPE;
  const depotCount = options.activeDepotCount ?? 0;

  if (depotCount >= depotThreshold || contentWidthPx > widthThreshold) {
    return "landscape";
  }
  return "portrait";
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

async function renderElementToPdfBlobCore(
  element: HTMLElement,
  options?: PdfFromElementOptions
): Promise<{ blob: Blob; fileName: string }> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const scale = options?.scale ?? 2;
  const wideTableSelector = options?.wideTableSelector ?? ".daily-summary-table";

  const captureExtents = measureElementCaptureExtents(
    element,
    options?.captureFullContentWidth ? { wideTableSelector } : undefined
  );

  const orientation = resolvePdfOrientation(options, captureExtents.width);
  const cloneOptions: Html2CanvasCloneOptions = {
    contentWidth: captureExtents.width,
    contentHeight: captureExtents.height,
    ...(options?.captureFullContentWidth
      ? {
          wideTableSelector,
          minPdfFontPt: options.minPdfFontPt ?? DEFAULT_MIN_PDF_FONT_PT,
        }
      : {}),
  };

  const canvas = await runWithHtml2CanvasCompat(() =>
    html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: captureExtents.width,
      windowHeight: captureExtents.height,
      width: captureExtents.width,
      height: captureExtents.height,
      onclone: (clonedDoc, clonedElement) => {
        const clonedRoot =
          clonedElement instanceof HTMLElement ? clonedElement : element;
        clonedRoot.setAttribute("data-pdf-capture-root", "true");
        prepareHtml2CanvasClone(clonedDoc, element, clonedRoot, cloneOptions);
      },
    })
  );

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({
    orientation: orientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  addCanvasImageToPdfPages(pdf, imgData, canvas, pageWidth, pageHeight);

  const blob = pdf.output("blob");
  const fileName = sanitizeFileName(options?.fileName ?? "document.pdf");

  return { blob, fileName };
}

export async function renderElementToPdfBlob(
  element: HTMLElement,
  options?: PdfFromElementOptions
): Promise<{ blob: Blob; fileName: string }> {
  await waitForDocumentFonts();

  if (element.querySelector(".dispatch-klmc-print-a4")) {
    return withKlMcPrintPdfCaptureLayout(element, () =>
      renderElementToPdfBlobCore(element, options)
    );
  }

  return renderElementToPdfBlobCore(element, options);
}

function triggerBlobDownload(blob: Blob, fileName: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}

function isMobileShareEnvironment() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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

  if (isMobileShareEnvironment()) {
    return {
      method: "unsupported",
      message:
        "当前浏览器无法直接分享 PDF 文件。请换用 iPhone/iPad Safari 或 Android Chrome，或使用下方「打印」后选择「存储到文件」。",
    };
  }

  const downloaded = triggerBlobDownload(blob, fileName);
  if (!downloaded) {
    return {
      method: "unsupported",
      message:
        "无法触发 PDF 下载。请使用「打印」按钮，在打印对话框中选择「另存为 PDF」。",
    };
  }

  return {
    method: "download",
    message:
      "此浏览器不支持直接分享 PDF 文件，已触发下载。请在下载完成后从文件管理器分享。",
  };
}

export async function shareElementAsPdf(
  element: HTMLElement,
  payload: PdfSharePayload,
  options?: PdfFromElementOptions
): Promise<PdfShareResult> {
  const { blob, fileName } = await renderElementToPdfBlob(element, {
    ...options,
    fileName: payload.fileName,
  });
  return sharePdfBlob(blob, fileName, payload);
}
