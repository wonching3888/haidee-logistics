/**
 * Automated A5 print verification — reproduces the REAL click-Print timing path.
 *
 * Critical regression this script must catch:
 *   Measuring getBoundingClientRect() on SCREEN styles (before @media print /
 *   Tailwind print: densification) yields an inflated height → scale << 1 →
 *   over-compressed printout. Fit MUST run inside beforeprint (print media on).
 *
 * Flow under test (mirrors printVoucherA5):
 *   1. Screen media (fat Tailwind spacing) — baseline
 *   2. emulateMedia('print') — as the browser does before beforeprint
 *   3. Fire beforeprint → applyVoucherA5PrintFit → record scale
 *   4. afterprint → clear zoom
 *   5. PDF page-count under preferCSSPageSize A5
 *
 * Also asserts the OLD buggy path (measure on screen) would over-compress
 * short vouchers, so this methodology gap cannot silently return.
 *
 * Run: npx tsx scripts/_verify-pv-a5-print.ts
 * Exit 0 only when all asserts pass.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = process.cwd();
const OUT = path.join(
  process.env.HOME ?? ROOT,
  "Desktop/Screenshots/a5-print-verify"
);
const CSS_DOC = fs.readFileSync(
  path.join(ROOT, "components/documents/document-print.css"),
  "utf8"
);
const CSS_PV = fs.readFileSync(
  path.join(ROOT, "components/cash-book/cash-book-voucher-print.css"),
  "utf8"
);
const CSS_GLOBAL_PRINT = `
@media print {
  .no-print { display: none !important; }
  html, body, .flex.h-screen {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    display: block !important;
  }
}
`;
const LOGO = `data:image/png;base64,${fs
  .readFileSync(path.join(ROOT, "public/logo.png"))
  .toString("base64")}`;

const A5_H_MM = 210;
const A5_FIT_MM = 200;

/** Short 1-line voucher (like PV-20260715-004) must not need meaningful zoom. */
const SHORT_SCALE_MIN = 0.98;
/**
 * Screen-layout height must be substantially taller than print-layout height,
 * otherwise the fixture cannot demonstrate the beforeprint timing pitfall.
 */
const SCREEN_VS_PRINT_HEIGHT_RATIO_MIN = 1.4;

type CaseName = "short" | "stress";

function countPdfPages(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page(?!\w)/g) ?? []).length;
}

/** Same algorithm as lib/cash-book/voucher-print-fit.ts (kept in sync manually). */
const FIT_RUNTIME_JS = `
window.__a5Fit = (function () {
  const A5_FIT_HEIGHT_MM = ${A5_FIT_MM};
  function a5FitHeightPx() { return (A5_FIT_HEIGHT_MM * 96) / 25.4; }
  let lastScale;
  function applyVoucherA5PrintFit(el) {
    el.style.zoom = "1";
    const height = el.getBoundingClientRect().height;
    const scale = Math.min(1, a5FitHeightPx() / Math.max(height, 1));
    el.style.zoom = String(scale);
    lastScale = scale;
    return scale;
  }
  function clearVoucherA5PrintFit(el) { el.style.zoom = ""; }
  function printVoucherA5(el) {
    if (!el) { window.print(); return; }
    const onBeforePrint = () => { applyVoucherA5PrintFit(el); };
    const onAfterPrint = () => {
      clearVoucherA5PrintFit(el);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    window.print();
  }
  return {
    applyVoucherA5PrintFit,
    clearVoucherA5PrintFit,
    printVoucherA5,
    getLastScale: () => lastScale,
    measure: (el) => {
      const h = el.getBoundingClientRect().height;
      return {
        heightPx: h,
        heightMm: +(h / (96 / 25.4)).toFixed(2),
        logoH: el.querySelector(".haidee-invoice-letterhead-logo")
          ?.getBoundingClientRect().height ?? null,
        sigMinH: getComputedStyle(el.querySelector(".payment-voucher-sig-line")).minHeight,
        padding: getComputedStyle(el).padding,
        fontSize: getComputedStyle(el).fontSize,
      };
    },
  };
})();
`;

function buildHtml(kind: CaseName): string {
  const lines =
    kind === "short"
      ? [["2026-07-15 / THONGDANG / เที่ยว / SONGKHLA", "1,200.00"]]
      : [
          [
            "2026-07-15 / P.NARONG / เที่ยวครั้ง / SONGKHLA → PATTANI → HATYAI / fuel + allowance + border fee with a long wrap",
            "45,600.00",
          ],
          [
            "Handling charge / ค่าดำเนินการ Extra note line that must wrap under A5 width",
            "3,250.50",
          ],
          [
            "Adjustment / ปรับปรุง รายการเพิ่มเติมเพื่อทดสอบหลายบรรทัดในตาราง",
            "999.99",
          ],
          ["Subtotal carry / รวมย่อย", "49,850.49"],
        ];
  const words =
    kind === "short"
      ? "หนึ่งพันสองร้อยบาทถ้วน / One Thousand Two Hundred Baht Only"
      : "สี่หมื่นเก้าพันแปดร้อยห้าสิบบาทสี่สิบเก้าสตางค์ / Forty-Nine Thousand Eight Hundred Fifty Baht and Forty-Nine Satang Only — intentionally long bilingual amount-in-words";

  const bodyRows = lines
    .map(
      ([p, a]) => `<tr class="border-b border-gray-300">
      <td class="py-2 pr-2 break-words">${p}</td>
      <td class="py-2 text-right font-mono whitespace-nowrap">${a}</td>
    </tr>`
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,"Noto Sans Thai",Tahoma,sans-serif}
.mt-4{margin-top:1rem}.mt-1{margin-top:.25rem}.mt-6{margin-top:1.5rem}.mt-8{margin-top:2rem}.mt-10{margin-top:2.5rem}
.p-6{padding:1.5rem}.p-3{padding:.75rem}.text-lg{font-size:1.125rem}.text-sm{font-size:.875rem}.text-xs{font-size:.75rem}
.font-bold{font-weight:700}.font-medium{font-weight:500}.font-mono{font-family:ui-monospace,monospace}
.text-center{text-align:center}.text-right{text-align:right}.text-left{text-align:left}
.bg-white{background:#fff}.bg-gray-50{background:#f9fafb}.border{border:1px solid #d1d5db}
.border-b{border-bottom:1px solid #d1d5db}.border-b-2{border-bottom:2px solid #000}.border-t-2{border-top:2px solid #000}
.border-black{border-color:#000}.border-gray-300{border-color:#d1d5db}.rounded-lg{border-radius:.5rem}.rounded{border-radius:.25rem}
.w-full{width:100%}.w-32{width:8rem}.grid{display:grid}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.gap-2{gap:.5rem}.gap-6{gap:1.5rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.pr-2{padding-right:.5rem}
.min-h-\\[3rem\\]{min-height:3rem}.break-words{overflow-wrap:anywhere}.leading-relaxed{line-height:1.625}
.border-collapse{border-collapse:collapse}.whitespace-nowrap{white-space:nowrap}
.space-y-4>*+*{margin-top:1rem}.no-print{display:block}
.flex{display:flex}.h-screen{height:100vh}
${CSS_GLOBAL_PRINT}
${CSS_DOC}
${CSS_PV}
</style></head>
<body>
<div class="flex h-screen" style="overflow:hidden">
  <div class="no-print">SIDEBAR</div>
  <main style="flex:1;overflow:auto;padding:1.5rem">
    <div class="space-y-4">
      <div class="no-print">TOOLBAR Print buttons</div>
      <div class="document-print payment-voucher-print rounded-lg border bg-white p-6" id="voucher">
        <div class="haidee-invoice-letterhead">
          <img class="haidee-invoice-letterhead-logo" src="${LOGO}" alt="Logo"/>
          <div class="haidee-invoice-letterhead-text">
            <div class="haidee-invoice-letterhead-line haidee-invoice-letterhead-name-th">บริษัท ไฮดี โลจิสติกส์ จำกัด</div>
            <div class="haidee-invoice-letterhead-line haidee-invoice-letterhead-name-en">HAI DEE LOGISTICS CO., LTD.</div>
          </div>
        </div>
        <h1 class="mt-4 text-center text-lg font-bold">ใบสำคัญจ่าย / Payment Voucher</h1>
        <div class="payment-voucher-meta mt-4 grid gap-2 text-sm" style="grid-template-columns:1fr 1fr">
          <p><span class="font-medium">เลขที่ / Voucher No.:</span> <span class="font-mono">PV-VERIFY-${kind.toUpperCase()}</span></p>
          <p><span class="font-medium">วันที่ / Date:</span> 15/07/2026</p>
          <p style="grid-column:1/-1"><span class="font-medium">จ่ายให้ / Paid To:</span> THONGDANG LOGISTICS PARTNER CO., LTD.</p>
          <p><span class="font-medium">วิธีชำระ / Payment Method:</span> Transfer</p>
          <p><span class="font-medium">วันครบกำหนด / Due Date:</span> 20/07/2026</p>
        </div>
        <table class="payment-voucher-table mt-6 w-full border-collapse text-sm">
          <thead>
            <tr class="border-b-2 border-black">
              <th class="py-2 pr-2 text-left">รายละเอียด / Particulars</th>
              <th class="w-32 py-2 text-right whitespace-nowrap">จำนวนเงิน / Amount (THB)</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
            <tr class="border-t-2 border-black font-bold">
              <td class="py-2 text-right">รวม / Total</td>
              <td class="py-2 text-right font-mono">${kind === "short" ? "1,200.00" : "49,850.49"}</td>
            </tr>
          </tbody>
        </table>
        <div class="payment-voucher-words mt-4 rounded border border-gray-300 bg-gray-50 p-3 text-sm">
          <p class="font-medium">จำนวนเงิน (ตัวอักษร) / Amount in words</p>
          <p class="payment-voucher-amount-words mt-1 break-words leading-relaxed">${words}</p>
        </div>
        <div class="payment-voucher-signatures mt-10 grid grid-cols-3 gap-6 text-center text-sm">
          <div><div class="payment-voucher-sig-line min-h-[3rem] border-b border-black"></div><p class="mt-1">ผู้รับเงิน / Payee</p></div>
          <div><div class="payment-voucher-sig-line min-h-[3rem] border-b border-black"></div><p class="mt-1">ผู้จัดทำ / Prepared by</p></div>
          <div><div class="payment-voucher-sig-line min-h-[3rem] border-b border-black"></div><p class="mt-1">ผู้อนุมัติ / Approved by</p></div>
        </div>
        <p class="payment-voucher-footer mt-8 text-xs">เอกสารนี้เป็นหลักฐานการจ่ายเงินสด / This voucher records a cash payment (no ledger posting yet).</p>
      </div>
    </div>
  </main>
</div>
<script>${FIT_RUNTIME_JS}</script>
</body></html>`;
}

async function runCase(page: Page, kind: CaseName) {
  await page.setContent(buildHtml(kind), { waitUntil: "load" });
  // Stay on SCREEN media first — this is the timing pitfall.
  await page.emulateMedia({ media: "screen" });

  const screenMeasure = await page.evaluate(`(() => {
    const el = document.getElementById("voucher");
    const m = window.__a5Fit.measure(el);
    const buggyScale = window.__a5Fit.applyVoucherA5PrintFit(el);
    window.__a5Fit.clearVoucherA5PrintFit(el);
    return { ...m, buggyScreenScale: buggyScale };
  })()`);

  // Stub window.print like a headless print job: browser has already switched
  // to print media before beforeprint (Playwright emulateMedia does that step).
  await page.evaluate(`(() => {
    window.print = function () {
      window.dispatchEvent(new Event("beforeprint"));
      window.dispatchEvent(new Event("afterprint"));
    };
  })()`);

  await page.emulateMedia({ media: "print" });

  const printPath = await page.evaluate(`(() => {
    const el = document.getElementById("voucher");
    const beforeFit = window.__a5Fit.measure(el);
    window.__a5Fit.printVoucherA5(el);
    const scale = window.__a5Fit.getLastScale();
    // afterprint cleared zoom; re-apply for PDF page-count check
    window.__a5Fit.applyVoucherA5PrintFit(el);
    const afterFit = window.__a5Fit.measure(el);
    return {
      beforeFit,
      scale,
      afterFit,
      noPrintHidden:
        getComputedStyle(document.querySelector(".no-print")).display === "none",
      page: getComputedStyle(el).page,
      zoomAfterClearWouldBeEmpty: (() => {
        window.__a5Fit.clearVoucherA5PrintFit(el);
        const cleared = el.style.zoom;
        window.__a5Fit.applyVoucherA5PrintFit(el);
        return cleared === "" || cleared === "normal";
      })(),
    };
  })()`);

  const pdfCssZoom = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  const pdfA4Zoom = await page.pdf({
    format: "A4",
    preferCSSPageSize: false,
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });

  const mediaBox =
    [
      ...pdfCssZoom
        .toString("latin1")
        .matchAll(/\/MediaBox\s*\[\s*([0-9.\s]+)\]/g),
    ].map((m) => m[1].trim())[0] ?? null;

  fs.writeFileSync(path.join(OUT, `pv-${kind}-a5-zoom.pdf`), pdfCssZoom);
  await page.screenshot({
    path: path.join(OUT, `pv-${kind}-print-media.png`),
    fullPage: true,
  });

  return {
    kind,
    screenMeasure,
    printPath,
    pages: {
      preferCss_zoom: countPdfPages(pdfCssZoom),
      a4_zoom: countPdfPages(pdfA4Zoom),
    },
    mediaBoxZoom: mediaBox,
    heightRatio: +(
      screenMeasure.heightMm / printPath.beforeFit.heightMm
    ).toFixed(3),
    scaleDelta: +(printPath.scale - screenMeasure.buggyScreenScale).toFixed(4),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 900, height: 1200 },
  });

  const results = [];
  try {
    for (const kind of ["short", "stress"] as CaseName[]) {
      const r = await runCase(page, kind);
      results.push(r);
      console.log(JSON.stringify(r, null, 2));
    }

    const failures: string[] = [];
    for (const r of results) {
      if (r.pages.preferCss_zoom !== 1) {
        failures.push(`${r.kind}: preferCss_zoom=${r.pages.preferCss_zoom}`);
      }
      if (r.pages.a4_zoom !== 1) {
        failures.push(`${r.kind}: a4_zoom=${r.pages.a4_zoom}`);
      }
      if (!r.printPath.noPrintHidden) {
        failures.push(`${r.kind}: .no-print still visible in print media`);
      }
      if (!r.mediaBoxZoom || !r.mediaBoxZoom.startsWith("0 0 420")) {
        failures.push(`${r.kind}: MediaBox not A5 (${r.mediaBoxZoom})`);
      }
      if (r.printPath.afterFit.heightMm > A5_FIT_MM + 0.5) {
        failures.push(
          `${r.kind}: after beforeprint-fit height ${r.printPath.afterFit.heightMm}mm > ${A5_FIT_MM}mm`
        );
      }

      // Methodology: screen layout must be much taller than print layout.
      if (r.heightRatio < SCREEN_VS_PRINT_HEIGHT_RATIO_MIN) {
        failures.push(
          `${r.kind}: screen/print height ratio ${r.heightRatio} < ${SCREEN_VS_PRINT_HEIGHT_RATIO_MIN} (fixture cannot catch timing bug)`
        );
      }
      // Old buggy path (measure on screen) must zoom more aggressively than beforeprint.
      if (r.screenMeasure.buggyScreenScale >= r.printPath.scale - 0.001) {
        failures.push(
          `${r.kind}: buggy screen scale ${r.screenMeasure.buggyScreenScale} not < beforeprint scale ${r.printPath.scale}`
        );
      }

      // Short 1-line voucher (PV-20260715-004 class): scale ≈ 1
      if (r.kind === "short" && r.printPath.scale < SHORT_SCALE_MIN) {
        failures.push(
          `short: beforeprint scale ${r.printPath.scale} < ${SHORT_SCALE_MIN} (still over-compressing)`
        );
      }
      if (r.kind === "short" && r.screenMeasure.buggyScreenScale >= SHORT_SCALE_MIN) {
        failures.push(
          `short: buggy screen scale ${r.screenMeasure.buggyScreenScale} unexpectedly ≥ ${SHORT_SCALE_MIN} (expected unnecessary zoom on screen measure)`
        );
      }
    }

    const pass = failures.length === 0;
    fs.writeFileSync(
      path.join(OUT, "verify-results.json"),
      JSON.stringify(
        {
          a5HeightMm: A5_H_MM,
          a5FitMm: A5_FIT_MM,
          shortScaleMin: SHORT_SCALE_MIN,
          screenVsPrintHeightRatioMin: SCREEN_VS_PRINT_HEIGHT_RATIO_MIN,
          results,
          failures,
          note:
            "Scale must be measured inside beforeprint (print media on). Measuring on screen styles over-compresses.",
          pass,
        },
        null,
        2
      )
    );

    console.log("\n=== SUMMARY ===");
    console.log("failures:", failures);
    console.log("PASS?", pass);
    console.log("artifacts:", OUT);
    if (!pass) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
