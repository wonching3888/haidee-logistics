/** Apply Chromium `zoom` so layout boxes shrink (unlike transform) for A5 fit. */

/** Leave headroom under full A5 (210mm) for print-dialog quirks without
 *  re-introducing large CSS @page margins (which stack with browser defaults). */
const A5_FIT_HEIGHT_MM = 200;

/** Last scale applied by applyVoucherA5PrintFit (for tests / diagnostics). */
export let lastVoucherA5PrintScale: number | undefined;

export function a5FitHeightPx(): number {
  return (A5_FIT_HEIGHT_MM * 96) / 25.4;
}

/** @deprecated use a5FitHeightPx */
export function a5HeightPx(): number {
  return a5FitHeightPx();
}

/**
 * Reset then scale element so its border-box height fits one A5 page.
 * Must run while @media print styles are already active (e.g. inside
 * `beforeprint`) — measuring screen-layout height over-compresses.
 */
export function applyVoucherA5PrintFit(el: HTMLElement): number {
  el.style.zoom = "1";
  const height = el.getBoundingClientRect().height;
  const scale = Math.min(1, a5FitHeightPx() / Math.max(height, 1));
  el.style.zoom = String(scale);
  lastVoucherA5PrintScale = scale;
  return scale;
}

export function clearVoucherA5PrintFit(el: HTMLElement) {
  el.style.zoom = "";
}

/**
 * Print with A5 fit applied in `beforeprint` (print styles already active)
 * and cleared in `afterprint`.
 *
 * Do NOT measure/zoom before calling window.print() — Tailwind `print:` /
 * @media print densification is not applied yet on screen, so the scale
 * would be wrongly small (over-compressed printout).
 */
export function printVoucherA5(el: HTMLElement | null): void {
  if (!el) {
    window.print();
    return;
  }

  const onBeforePrint = () => {
    applyVoucherA5PrintFit(el);
  };
  const onAfterPrint = () => {
    clearVoucherA5PrintFit(el);
    window.removeEventListener("beforeprint", onBeforePrint);
    window.removeEventListener("afterprint", onAfterPrint);
  };

  window.addEventListener("beforeprint", onBeforePrint);
  window.addEventListener("afterprint", onAfterPrint);
  window.print();
}
