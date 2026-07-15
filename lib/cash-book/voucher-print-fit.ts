/** Apply Chromium `zoom` so layout boxes shrink (unlike transform) for A5 fit. */

/** Leave headroom under full A5 (210mm) for print-dialog quirks without
 *  re-introducing large CSS @page margins (which stack with browser defaults). */
const A5_FIT_HEIGHT_MM = 200;

export function a5FitHeightPx(): number {
  return (A5_FIT_HEIGHT_MM * 96) / 25.4;
}

/** @deprecated use a5FitHeightPx */
export function a5HeightPx(): number {
  return a5FitHeightPx();
}

/** Reset then scale element so its border-box height fits one A5 page. */
export function applyVoucherA5PrintFit(el: HTMLElement): number {
  el.style.zoom = "1";
  const height = el.getBoundingClientRect().height;
  const scale = Math.min(1, a5FitHeightPx() / Math.max(height, 1));
  el.style.zoom = String(scale);
  return scale;
}

export function clearVoucherA5PrintFit(el: HTMLElement) {
  el.style.zoom = "";
}

/**
 * Fit-then-print. Chrome blocks inside window.print() until the dialog closes,
 * so clearing zoom afterwards is safe for the print job already sent.
 */
export function printVoucherA5(el: HTMLElement | null): number | undefined {
  if (!el) {
    window.print();
    return;
  }
  const scale = applyVoucherA5PrintFit(el);
  try {
    window.print();
  } finally {
    clearVoucherA5PrintFit(el);
  }
  return scale;
}
