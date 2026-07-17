/**
 * Prototype: HTML → PDF blob + Web Share API (client-only).
 * Uses html2canvas + jsPDF — rasterized pages, not selectable text.
 */

import {
  MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD,
} from "@/lib/market-do-route-groups";
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
  /** Capture each matching section as its own PDF segment (Market D/O). */
  sectionSelector?: string;
  /** When set with autoLandscape, use this column count for landscape decision. */
  activeColumnCount?: number;
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

// TEMPORARY(踩线排查用): 为 true 时每份生成的 PDF 末尾会多一页诊断数字,排查结束后请删除
// 这个常量以及 renderElementToPdfBlobCore 里那一段 `if (PDF_DEBUG_MEASURE)` 代码。
const PDF_DEBUG_MEASURE = false;

async function waitForDocumentFonts() {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

/**
 * 检测页面当前的"环境缩放"比例（比如浏览器缩放不是100%时）。
 * html2canvas 手动还原布局时的取整计算对非100%缩放很敏感，会导致表格文字在格子内偏移（"踩线"）。
 * 做法：量一个声明为1000px的探测元素，实际渲染出来是多少px，两者的比值就是当前缩放比例。
 */
function detectAmbientZoomScale(doc: Document): number {
  try {
    const probe = doc.createElement("div");
    probe.style.position = "fixed";
    probe.style.left = "-99999px";
    probe.style.top = "0";
    probe.style.width = "1000px";
    probe.style.height = "1000px";
    probe.style.visibility = "hidden";
    doc.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const scale = rect.width / 1000;
    doc.body.removeChild(probe);
    return scale > 0 && Number.isFinite(scale) ? scale : 1;
  } catch {
    return 1;
  }
}

/**
 * Collect Y-positions (in captured-canvas pixel space) that are safe to cut a PDF page at:
 * boundaries between table rows (<tr>) and between standalone text lines (title/date/grand-total),
 * so that addCanvasImageToPdfPages() never slices through the middle of a row's text.
 */
function collectSafeCutBoundariesPx(root: HTMLElement, scale: number): number[] {
  const rootRect = root.getBoundingClientRect();
  const boundaries = new Set<number>();
  boundaries.add(0);

  function isAtomicUnit(el: Element): boolean {
    if (el.tagName === "TR") return true;
    const elementChildren = Array.from(el.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );
    return elementChildren.length === 0 && !el.closest("tr");
  }

  root.querySelectorAll("*").forEach((el) => {
    if (!isAtomicUnit(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const top = (rect.top - rootRect.top) * scale;
    const bottom = (rect.bottom - rootRect.top) * scale;
    if (top >= 0) boundaries.add(top);
    if (bottom >= 0) boundaries.add(bottom);
  });

  boundaries.add(root.scrollHeight * scale);
  return Array.from(boundaries).sort((a, b) => a - b);
}

/** Nearest safe boundary at-or-before naiveTargetPx, leaving ≥20% of a page's content on this page. */
function pickSafeCutY(
  naiveTargetPx: number,
  safeBoundariesPx: number[],
  minPx: number,
  pageHeightPx: number,
  canvasHeightPx: number
): number {
  if (naiveTargetPx >= canvasHeightPx - 0.5) {
    return canvasHeightPx;
  }
  let best: number | null = null;
  for (const y of safeBoundariesPx) {
    if (y <= naiveTargetPx && y > minPx + pageHeightPx * 0.2) {
      best = y;
    }
    if (y > naiveTargetPx) {
      break;
    }
  }
  return best ?? naiveTargetPx;
}

/** Extract one horizontal slice [sy, sy+sh) of a canvas as its own PNG data URL. */
function sliceCanvasToDataUrl(canvas: HTMLCanvasElement, sy: number, sh: number): string {
  const slice = document.createElement("canvas");
  slice.width = canvas.width;
  slice.height = Math.max(1, Math.round(sh));
  const ctx = slice.getContext("2d");
  if (!ctx) {
    return canvas.toDataURL("image/png");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, slice.width, slice.height);
  ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
  return slice.toDataURL("image/png");
}

function addCanvasImageToPdfPages(
  pdf: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  imgData: string,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  options?: { startOnNewPage?: boolean; safeBoundariesPx?: number[] }
) {
  const renderWidth = pageWidth;
  const renderHeight = (canvas.height * renderWidth) / canvas.width;

  if (options?.startOnNewPage) {
    pdf.addPage();
  }

  if (renderHeight <= pageHeight + 0.5) {
    pdf.addImage(imgData, "PNG", 0, 0, renderWidth, renderHeight, undefined, "SLOW");
    return;
  }

  const pxPerMm = canvas.width / renderWidth;
  const pageHeightPx = pageHeight * pxPerMm;
  const safeBoundariesPx = options?.safeBoundariesPx;

  let consumedPx = 0;
  let isFirstSlice = true;

  while (consumedPx < canvas.height - 0.5) {
    if (!isFirstSlice) {
      pdf.addPage();
    }
    isFirstSlice = false;

    const naiveTargetPx = Math.min(consumedPx + pageHeightPx, canvas.height);
    const cutPx = safeBoundariesPx
      ? pickSafeCutY(naiveTargetPx, safeBoundariesPx, consumedPx, pageHeightPx, canvas.height)
      : naiveTargetPx;

    const sliceHeightPx = cutPx - consumedPx;
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    const sliceDataUrl = sliceCanvasToDataUrl(canvas, consumedPx, sliceHeightPx);
    pdf.addImage(sliceDataUrl, "PNG", 0, 0, renderWidth, sliceHeightMm, undefined, "SLOW");

    consumedPx = cutPx;
  }
}

/**
 * TEMPORARY diagnostic (踩线排查用,诊断结束后会删除): sample a vertical strip of the
 * captured canvas and report, for a few detected table rows, the pixel gap above/below the
 * text within its border box. Safe no-op-on-failure — must never break real PDF sharing.
 */
function debugMeasureRowBands(
  canvas: HTMLCanvasElement
): Array<{ y: number; textH: number; gapAbove: number; gapBelow: number }> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const x0 = Math.floor(canvas.width * 0.1);
  const x1 = Math.floor(canvas.width * 0.3);
  const w = Math.max(1, x1 - x0);
  const { data } = ctx.getImageData(x0, 0, w, canvas.height);

  function darkFracAtRow(y: number): number {
    let dark = 0;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luminance < 100) dark += 1;
    }
    return dark / w;
  }

  function classify(f: number): "B" | "T" | "." {
    if (f > 0.7) return "B";
    if (f > 0.02) return "T";
    return ".";
  }

  const labels: Array<"B" | "T" | "."> = [];
  for (let y = 0; y < canvas.height; y += 1) {
    labels.push(classify(darkFracAtRow(y)));
  }

  const bands: Array<["B" | "T" | ".", number, number]> = [];
  let cur = labels[0];
  let start = 0;
  for (let i = 1; i < labels.length; i += 1) {
    if (labels[i] !== cur) {
      bands.push([cur, start, i - 1]);
      cur = labels[i];
      start = i;
    }
  }
  bands.push([cur, start, labels.length - 1]);

  const results: Array<{ y: number; textH: number; gapAbove: number; gapBelow: number }> = [];
  for (let i = 1; i < bands.length - 1 && results.length < 6; i += 1) {
    const [kind, s, e] = bands[i];
    if (kind !== "T") continue;
    const textH = e - s + 1;
    if (textH < 12) continue;
    const before = bands[i - 1];
    const after = bands[i + 1];
    const gapAbove = before[0] === "." ? before[2] - before[1] + 1 : 0;
    const gapBelow = after[0] === "." ? after[2] - after[1] + 1 : 0;
    results.push({ y: s, textH, gapAbove, gapBelow });
  }
  return results;
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
  options?: PdfFromElementOptions,
  pdfContext?: {
    pdf?: InstanceType<(typeof import("jspdf"))["jsPDF"]>;
    startOnNewPage?: boolean;
  }
): Promise<{
  blob?: Blob;
  fileName: string;
  pdf: InstanceType<(typeof import("jspdf"))["jsPDF"]>;
}> {
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
  // 分页安全切割线改为在 onclone 里、套用打印专用样式(如格子 padding 调整)之后再量，
  // 避免"探路时量到的行高"和"实际截图里的行高"对不上，导致翻页时切到行的中间。
  let safeBoundariesPx: number[] = [];

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

  const liveAmbientZoomScale = detectAmbientZoomScale(document);
  const cloneDebugInfo: string[] = [];

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
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc, clonedElement) => {
        const clonedRoot =
          clonedElement instanceof HTMLElement ? clonedElement : element;
        clonedRoot.setAttribute("data-pdf-capture-root", "true");
        prepareHtml2CanvasClone(clonedDoc, element, clonedRoot, cloneOptions);
        safeBoundariesPx = collectSafeCutBoundariesPx(clonedRoot, scale);

        const ambientZoomScale = detectAmbientZoomScale(clonedDoc);
        if (Math.abs(ambientZoomScale - 1) > 0.01) {
          clonedRoot.style.zoom = `${(1 / ambientZoomScale) * 100}%`;
        }

        if (PDF_DEBUG_MEASURE) {
          try {
            cloneDebugInfo.push(
              `zoom: live=${liveAmbientZoomScale} clonedDetected=${ambientZoomScale} appliedStyle=${clonedRoot.style.zoom || "(none)"}`
            );
            const styleTag = clonedDoc.querySelector(
              "[data-html2canvas-market-do-baseline]"
            );
            cloneDebugInfo.push(`baselineStyleTagFound=${!!styleTag}`);
            if (styleTag?.textContent) {
              cloneDebugInfo.push(
                `styleText=${styleTag.textContent.replace(/\s+/g, " ").trim()}`
              );
            }
            const sampleTd = clonedRoot.querySelector(
              ".market-do-table .market-do-stall-col"
            );
            if (sampleTd instanceof HTMLElement) {
              const view = clonedDoc.defaultView;
              const cs = view?.getComputedStyle(sampleTd);
              if (cs) {
                cloneDebugInfo.push(
                  `td: paddingTop=${cs.paddingTop} paddingBottom=${cs.paddingBottom} lineHeight=${cs.lineHeight} fontSize=${cs.fontSize} height=${sampleTd.offsetHeight} verticalAlign=${cs.verticalAlign} boxSizing=${cs.boxSizing}`
                );
              }
              const parentRow = sampleTd.closest("tr");
              if (parentRow instanceof HTMLElement) {
                cloneDebugInfo.push(`tr offsetHeight=${parentRow.offsetHeight}`);
              }

              // [诊断-only, 不改变任何显示效果] 直接对比:
              // (a) 这个格子里文字"真实、紧贴"的包围盒高度(用浏览器 Range API 量出来，反映真实排版结果，
              //     包括实际用来画字的字体);
              // (b) html2canvas 自己算出来、用来决定"从格子顶部往下多少像素画基线"的偏移量
              //     (完全照抄 html2canvas 内部 FontMetrics 的量法)。
              // 如果 (b) 明显大于 (a)，说明画字位置已经超出了文字自己实际所在的框(即被往下推)，
              // 这正好和"踩线"症状吻合。
              try {
                const textNode = Array.from(sampleTd.childNodes).find(
                  (n) => n.nodeType === 3 && !!n.textContent?.trim()
                );
                if (textNode) {
                  const range = clonedDoc.createRange();
                  range.selectNodeContents(textNode);
                  const rects = range.getClientRects();
                  if (rects.length > 0) {
                    const r = rects[0];
                    const probeFontFamily = cs?.fontFamily || "";
                    const probeFontSize = cs?.fontSize || "";
                    const probeContainer = clonedDoc.createElement("div");
                    const probeImg = clonedDoc.createElement("img");
                    const probeSpan = clonedDoc.createElement("span");
                    probeContainer.style.visibility = "hidden";
                    probeContainer.style.fontFamily = probeFontFamily;
                    probeContainer.style.fontSize = probeFontSize;
                    probeContainer.style.margin = "0";
                    probeContainer.style.padding = "0";
                    probeContainer.style.whiteSpace = "nowrap";
                    clonedDoc.body.appendChild(probeContainer);
                    probeImg.src =
                      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7";
                    probeImg.width = 1;
                    probeImg.height = 1;
                    probeImg.style.margin = "0";
                    probeImg.style.padding = "0";
                    probeImg.style.verticalAlign = "baseline";
                    probeSpan.style.fontFamily = probeFontFamily;
                    probeSpan.style.fontSize = probeFontSize;
                    probeSpan.style.margin = "0";
                    probeSpan.style.padding = "0";
                    probeSpan.appendChild(clonedDoc.createTextNode("Hidden Text"));
                    probeContainer.appendChild(probeSpan);
                    probeContainer.appendChild(probeImg);
                    const probedBaseline =
                      probeImg.offsetTop - probeSpan.offsetTop + 2;
                    clonedDoc.body.removeChild(probeContainer);
                    cloneDebugInfo.push(
                      `textRange: height=${r.height.toFixed(2)} fontFamily=${probeFontFamily} probedBaseline=${probedBaseline} overshoot=${(probedBaseline - r.height).toFixed(2)}`
                    );
                  } else {
                    cloneDebugInfo.push("textRange: no client rects found");
                  }
                } else {
                  cloneDebugInfo.push("textRange: no text node found in sampleTd");
                }
              } catch (err) {
                cloneDebugInfo.push(`textRange debug error: ${String(err)}`);
              }
            } else {
              cloneDebugInfo.push("sampleTd not found");
            }
          } catch (err) {
            cloneDebugInfo.push(`clone debug error: ${String(err)}`);
          }
        }
      },
    })
  );

  const imgData = canvas.toDataURL("image/png");
  const pdf =
    pdfContext?.pdf ??
    new jsPDF({
      orientation: orientation === "landscape" ? "l" : "p",
      unit: "mm",
      format: "a4",
    });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  addCanvasImageToPdfPages(pdf, imgData, canvas, pageWidth, pageHeight, {
    ...(pdfContext?.pdf
      ? { startOnNewPage: pdfContext.startOnNewPage ?? true }
      : {}),
    safeBoundariesPx,
  });

  if (PDF_DEBUG_MEASURE) {
    try {
      const debugRows = debugMeasureRowBands(canvas);
      pdf.addPage();
      pdf.setFontSize(8);
      pdf.text("PDF-DEBUG (temporary, will be removed after diagnosis):", 10, 10);
      let debugY = 16;
      debugRows.forEach((r, idx) => {
        pdf.text(
          `row${idx}: y=${r.y} textH=${r.textH} gapAbove=${r.gapAbove} gapBelow=${r.gapBelow}`,
          10,
          debugY
        );
        debugY += 6;
      });
      pdf.text(`canvas: ${canvas.width} x ${canvas.height}, scale=${scale}`, 10, debugY);
      debugY += 6;
      cloneDebugInfo.forEach((line) => {
        pdf.text(line.slice(0, 150), 10, debugY);
        debugY += 6;
      });
    } catch (err) {
      console.error("[PDF-DEBUG] measurement failed", err);
    }
  }

  const fileName = sanitizeFileName(options?.fileName ?? "document.pdf");

  return { pdf, fileName };
}

async function renderSectionsToPdfBlob(
  root: HTMLElement,
  sections: HTMLElement[],
  options?: PdfFromElementOptions
): Promise<{ blob: Blob; fileName: string }> {
  const activeColumnCount =
    options?.activeColumnCount ??
    Number(root.getAttribute("data-market-do-max-columns") ?? 0);

  const sectionOptions: PdfFromElementOptions = {
    ...options,
    autoLandscape: options?.autoLandscape ?? true,
    activeDepotCount: activeColumnCount,
    orientation:
      options?.orientation ??
      (activeColumnCount >=
        (options?.minDepotCountForLandscape ??
          MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD)
        ? "landscape"
        : "portrait"),
  };

  let pdf: InstanceType<(typeof import("jspdf"))["jsPDF"]> | undefined;
  let fileName = sanitizeFileName(options?.fileName ?? "document.pdf");

  for (let index = 0; index < sections.length; index += 1) {
    const result = await renderElementToPdfBlobCore(sections[index]!, sectionOptions, {
      pdf,
      startOnNewPage: index > 0,
    });
    pdf = result.pdf;
    fileName = result.fileName;
  }

  if (!pdf) {
    throw new Error("No PDF sections rendered");
  }

  return { blob: pdf.output("blob"), fileName };
}

export async function renderElementToPdfBlob(
  element: HTMLElement,
  options?: PdfFromElementOptions
): Promise<{ blob: Blob; fileName: string }> {
  await waitForDocumentFonts();

  if (options?.sectionSelector) {
    const sections = Array.from(
      element.querySelectorAll(options.sectionSelector)
    ).filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (sections.length > 0) {
      return renderSectionsToPdfBlob(element, sections, options);
    }
  }

  if (element.querySelector(".dispatch-klmc-print-a4")) {
    return withKlMcPrintPdfCaptureLayout(element, async () => {
      const result = await renderElementToPdfBlobCore(element, options);
      return { blob: result.pdf.output("blob"), fileName: result.fileName };
    });
  }

  const result = await renderElementToPdfBlobCore(element, options);
  return { blob: result.pdf.output("blob"), fileName: result.fileName };
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
