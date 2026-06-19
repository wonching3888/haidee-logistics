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

export function prepareHtml2CanvasClone(
  clonedDoc: Document,
  sourceRoot: HTMLElement,
  clonedRoot: HTMLElement
) {
  sanitizeClonedDocumentStyles(clonedDoc);
  inlineResolvedColorsForHtml2Canvas(sourceRoot, clonedRoot);
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
