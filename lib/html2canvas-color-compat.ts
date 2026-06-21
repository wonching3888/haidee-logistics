/**
 * html2canvas 1.x cannot parse oklch()/oklab()/color-mix() in stylesheets.
 * Sanitize cloned document + inline computed rgb() before capture.
 */

const ROOT_VAR_HEX: Record<string, string> = {
  "--background": "#ffffff",
  "--foreground": "#252525",
  "--card": "#ffffff",
  "--card-foreground": "#252525",
  "--popover": "#ffffff",
  "--popover-foreground": "#252525",
  "--primary": "#333333",
  "--primary-foreground": "#fafafa",
  "--secondary": "#f5f5f5",
  "--secondary-foreground": "#333333",
  "--muted": "#f5f5f5",
  "--muted-foreground": "#737373",
  "--accent": "#f5f5f5",
  "--accent-foreground": "#333333",
  "--destructive": "#dc2626",
  "--destructive-foreground": "#fafafa",
  "--border": "#e5e5e5",
  "--input": "#e5e5e5",
  "--ring": "#a3a3a3",
};

export function sanitizeCssTextForHtml2Canvas(cssText: string): string {
  return cssText
    .replace(/oklch\([^)]*\)/gi, "#252525")
    .replace(/oklab\([^)]*\)/gi, "#252525")
    .replace(/color-mix\([^)]*\)/gi, "transparent");
}

export function injectHtml2CanvasRootVarOverrides(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-html2canvas-oklch-fix", "true");
  const lines = Object.entries(ROOT_VAR_HEX).map(
    ([key, value]) => `${key}: ${value} !important;`
  );
  style.textContent = `:root { ${lines.join(" ")} }`;
  doc.head.appendChild(style);
}

export function sanitizeClonedDocumentStyles(doc: Document) {
  injectHtml2CanvasRootVarOverrides(doc);

  doc.querySelectorAll("style").forEach((node) => {
    if (node.textContent?.includes("oklch") || node.textContent?.includes("color-mix")) {
      node.textContent = sanitizeCssTextForHtml2Canvas(node.textContent);
    }
  });

  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (let index = rules.length - 1; index >= 0; index -= 1) {
        const rule = rules[index];
        if (!rule.cssText) continue;
        if (/oklch|oklab|color-mix/i.test(rule.cssText)) {
          sheet.deleteRule(index);
        }
      }
    } catch {
      // Cross-origin stylesheets cannot be read; rely on inline pass below.
    }
  }
}

function copyResolvedColorProperties(
  source: Element,
  target: HTMLElement
) {
  const computed = window.getComputedStyle(source);
  target.style.color = computed.color;
  target.style.backgroundColor = computed.backgroundColor;
  target.style.borderColor = computed.borderColor;
  target.style.borderTopColor = computed.borderTopColor;
  target.style.borderRightColor = computed.borderRightColor;
  target.style.borderBottomColor = computed.borderBottomColor;
  target.style.borderLeftColor = computed.borderLeftColor;
  target.style.outlineColor = computed.outlineColor;
  target.style.textDecorationColor = computed.textDecorationColor;
}

export function inlineResolvedColorsForHtml2Canvas(
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement
) {
  const sourceNodes: Element[] = [
    sourceRoot,
    ...Array.from(sourceRoot.querySelectorAll("*")),
  ];
  const cloneNodes: Element[] = [
    cloneRoot,
    ...Array.from(cloneRoot.querySelectorAll("*")),
  ];

  const limit = Math.min(sourceNodes.length, cloneNodes.length);
  for (let index = 0; index < limit; index += 1) {
    const source = sourceNodes[index];
    const clone = cloneNodes[index];
    if (!(source instanceof HTMLElement) || !(clone instanceof HTMLElement)) {
      continue;
    }
    copyResolvedColorProperties(source, clone);
  }
}

export interface Html2CanvasCloneOptions {
  /** When set, expand clone to this width so wide matrix tables are not clipped */
  contentWidth?: number;
  contentHeight?: number;
  wideTableSelector?: string;
  minPdfFontPt?: number;
}

export function expandOverflowContainersForCapture(
  cloneRoot: HTMLElement,
  options?: Html2CanvasCloneOptions
) {
  const queue: HTMLElement[] = [cloneRoot];
  while (queue.length > 0) {
    const node = queue.shift()!;
    node.style.setProperty("overflow", "visible", "important");
    node.style.setProperty("overflow-x", "visible", "important");
    node.style.setProperty("overflow-y", "visible", "important");
    node.style.setProperty("max-height", "none", "important");
    node.style.setProperty("max-width", "none", "important");

    if (node.classList.contains("scroll-matrix-table")) {
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("min-height", "0", "important");
    }

    for (const child of Array.from(node.children)) {
      if (child instanceof HTMLElement) {
        queue.push(child);
      }
    }
  }

  cloneRoot.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el.classList.contains("sticky")) {
      el.style.setProperty("position", "static", "important");
    }
  });

  if (options?.contentWidth && options.contentWidth > 0) {
    const widthPx = `${Math.ceil(options.contentWidth)}px`;
    cloneRoot.style.setProperty("width", widthPx, "important");
    cloneRoot.style.setProperty("min-width", widthPx, "important");

    const scrollHost = cloneRoot.querySelector(".scroll-matrix-table");
    if (scrollHost instanceof HTMLElement) {
      scrollHost.style.setProperty("width", widthPx, "important");
      scrollHost.style.setProperty("min-width", widthPx, "important");
    }

    const wideSelector = options.wideTableSelector ?? ".daily-summary-table";
    const table = cloneRoot.querySelector(wideSelector);
    if (table instanceof HTMLElement) {
      table.style.setProperty("width", "max-content", "important");
      table.style.setProperty("min-width", "max-content", "important");
      table.style.setProperty("table-layout", "auto", "important");
    }
  }

  if (options?.contentHeight && options.contentHeight > 0) {
    cloneRoot.style.setProperty("min-height", `${Math.ceil(options.contentHeight)}px`, "important");
  }
}

function injectPdfCaptureTypography(doc: Document, minPdfFontPt: number) {
  const style = doc.createElement("style");
  style.setAttribute("data-html2canvas-pdf-typography", "true");
  style.textContent = `
    [data-pdf-capture-root] .scroll-matrix-table {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
    }
    [data-pdf-capture-root] .daily-summary-table,
    [data-pdf-capture-root] .daily-summary-table .daily-summary-th,
    [data-pdf-capture-root] .daily-summary-table .daily-summary-td,
    [data-pdf-capture-root] .daily-summary-header p {
      font-size: ${minPdfFontPt}pt !important;
      line-height: 1.25 !important;
    }
  `;
  doc.head.appendChild(style);
}

export function prepareHtml2CanvasClone(
  clonedDoc: Document,
  sourceRoot: HTMLElement,
  clonedRoot: HTMLElement,
  options?: Html2CanvasCloneOptions
) {
  sanitizeClonedDocumentStyles(clonedDoc);
  inlineResolvedColorsForHtml2Canvas(sourceRoot, clonedRoot);
  expandOverflowContainersForCapture(clonedRoot, options);
  if (options?.minPdfFontPt && options.minPdfFontPt > 0) {
    injectPdfCaptureTypography(clonedDoc, options.minPdfFontPt);
  }
}

/**
 * Measure full scroll extents for wide matrix tables (opt-in; Daily Record PDF).
 * Temporarily expands overflow on the live DOM, then restores inline styles.
 */
export function measureElementCaptureExtents(
  sourceRoot: HTMLElement,
  options?: { wideTableSelector?: string }
): { width: number; height: number } {
  const wideSelector = options?.wideTableSelector ?? ".daily-summary-table";
  const table = sourceRoot.querySelector(wideSelector);
  const scrollHost = sourceRoot.querySelector(".scroll-matrix-table");

  const snapshots = new Map<HTMLElement, string>();
  const touched: HTMLElement[] = [];

  function touch(el: HTMLElement) {
    if (!snapshots.has(el)) {
      snapshots.set(el, el.style.cssText);
      touched.push(el);
    }
  }

  function expandForMeasure(el: HTMLElement) {
    touch(el);
    el.style.setProperty("overflow", "visible", "important");
    el.style.setProperty("overflow-x", "visible", "important");
    el.style.setProperty("overflow-y", "visible", "important");
    el.style.setProperty("max-width", "none", "important");
    el.style.setProperty("max-height", "none", "important");
  }

  expandForMeasure(sourceRoot);
  sourceRoot.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const overflow = window.getComputedStyle(el).overflowX;
    if (overflow === "hidden" || overflow === "auto" || overflow === "scroll") {
      expandForMeasure(el);
    }
  });

  if (scrollHost instanceof HTMLElement) {
    touch(scrollHost);
    scrollHost.style.setProperty("height", "auto", "important");
    scrollHost.style.setProperty("width", "max-content", "important");
    scrollHost.style.setProperty("min-width", "max-content", "important");
  }

  if (table instanceof HTMLElement) {
    touch(table);
    table.style.setProperty("width", "max-content", "important");
    table.style.setProperty("min-width", "max-content", "important");
    table.style.setProperty("table-layout", "auto", "important");
  }

  const width = Math.max(
    sourceRoot.scrollWidth,
    scrollHost instanceof HTMLElement ? scrollHost.scrollWidth : 0,
    table instanceof HTMLElement
      ? Math.max(table.scrollWidth, table.offsetWidth)
      : 0
  );
  const height = Math.max(
    sourceRoot.scrollHeight,
    scrollHost instanceof HTMLElement ? scrollHost.scrollHeight : 0,
    table instanceof HTMLElement ? table.scrollHeight : 0
  );

  for (const el of touched) {
    el.style.cssText = snapshots.get(el) ?? "";
  }

  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

function patchLiveDocumentStyleTags(doc: Document): () => void {
  const backups = new Map<HTMLStyleElement, string>();

  doc.querySelectorAll("style").forEach((node) => {
    const text = node.textContent ?? "";
    if (!/oklch|oklab|color-mix/i.test(text)) return;
    backups.set(node, text);
    node.textContent = sanitizeCssTextForHtml2Canvas(text);
  });

  const override = doc.createElement("style");
  override.setAttribute("data-html2canvas-live-oklch-fix", "true");
  const lines = Object.entries(ROOT_VAR_HEX).map(
    ([key, value]) => `${key}: ${value} !important;`
  );
  override.textContent = `:root { ${lines.join(" ")} }`;
  doc.head.appendChild(override);

  return () => {
    backups.forEach((text, node) => {
      node.textContent = text;
    });
    override.remove();
  };
}

/** Temporarily rewrite oklch in inline <style> tags on the live page during capture. */
export async function runWithHtml2CanvasCompat<T>(task: () => Promise<T>): Promise<T> {
  const restore = patchLiveDocumentStyleTags(document);
  try {
    return await task();
  } finally {
    restore();
  }
}
