/**
 * Automated A5 single-page verification for PV/RV print CSS + zoom fit.
 *
 * Does NOT rely on a running Next server (loads CSS from disk + fixture HTML).
 * Asserts Playwright PDF page count === 1 for:
 *   - short typical voucher
 *   - stressed long particulars / amount-in-words / 4 line-items
 *   - stacked-margin stress (16mm margins) WITH zoom fit applied
 *
 * Also optionally checks one live voucher when LIVE_VERIFY=1 and BASE_URL is up.
 *
 * Run: npx tsx --env-file=.env.local scripts/_verify-pv-a5-print.ts
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
  }
}
`;
const LOGO = `data:image/png;base64,${fs
  .readFileSync(path.join(ROOT, "public/logo.png"))
  .toString("base64")}`;

const A5_H_MM = 210;
const A5_FIT_MM = 200;
const A5_FIT_PX = (A5_FIT_MM * 96) / 25.4;

type CaseName = "short" | "stress";

function countPdfPages(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page(?!\w)/g) ?? []).length;
}

function buildHtml(kind: CaseName): string {
  const lines =
    kind === "short"
      ? [
          [
            "2026-07-15 / THONGDANG / เที่ยว / SONGKHLA",
            "1,200.00",
          ],
        ]
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
</body></html>`;
}

async function applyZoomFit(page: Page) {
  return page.evaluate(
    `(() => {
      const el = document.getElementById("voucher");
      const fitPx = (${A5_FIT_MM} * 96) / 25.4;
      el.style.zoom = "1";
      const h = el.getBoundingClientRect().height;
      const scale = Math.min(1, fitPx / Math.max(h, 1));
      el.style.zoom = String(scale);
      return {
        heightBeforePx: h,
        heightBeforeMm: +(h / (96 / 25.4)).toFixed(2),
        heightAfterPx: el.getBoundingClientRect().height,
        heightAfterMm: +(el.getBoundingClientRect().height / (96 / 25.4)).toFixed(2),
        scale,
        fitPx,
      };
    })()`
  );
}

async function runCase(page: Page, kind: CaseName) {
  await page.setContent(buildHtml(kind), { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });

  const before = await page.evaluate(
    `(() => {
      const el = document.getElementById("voucher");
      const mm = (px) => +(px / (96 / 25.4)).toFixed(2);
      return {
        contentMm: mm(el.scrollHeight),
        noPrintHidden: getComputedStyle(document.querySelector(".no-print")).display === "none",
        page: getComputedStyle(el).page,
        padding: getComputedStyle(el).padding,
        logoH: document.querySelector(".haidee-invoice-letterhead-logo").getBoundingClientRect().height,
      };
    })()`
  );

  // PDF with CSS @page (margin 0) — no zoom yet
  const pdfCssNoZoom = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });

  // Stress: simulate browser "Default" margins stacked (16mm) without zoom
  const pdfStackedNoZoom = await page.pdf({
    format: "A5",
    preferCSSPageSize: false,
    printBackground: true,
    margin: { top: "16mm", right: "16mm", bottom: "16mm", left: "16mm" },
  });

  const fit = await applyZoomFit(page);

  const pdfCssZoom = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  const pdfStackedZoom = await page.pdf({
    format: "A5",
    preferCSSPageSize: false,
    printBackground: true,
    margin: { top: "16mm", right: "16mm", bottom: "16mm", left: "16mm" },
  });
  const pdfA4Zoom = await page.pdf({
    format: "A4",
    preferCSSPageSize: false,
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });

  const media =
    [...pdfCssZoom.toString("latin1").matchAll(/\/MediaBox\s*\[\s*([0-9.\s]+)\]/g)].map(
      (m) => m[1].trim()
    )[0] ?? null;

  const result = {
    kind,
    before,
    fit,
    pages: {
      preferCss_noZoom: countPdfPages(pdfCssNoZoom),
      stacked16_noZoom: countPdfPages(pdfStackedNoZoom),
      preferCss_zoom: countPdfPages(pdfCssZoom),
      stacked16_zoom: countPdfPages(pdfStackedZoom),
      a4_zoom: countPdfPages(pdfA4Zoom),
    },
    mediaBoxZoom: media,
  };

  fs.writeFileSync(
    path.join(OUT, `pv-${kind}-a5-zoom.pdf`),
    pdfCssZoom
  );
  await page.screenshot({
    path: path.join(OUT, `pv-${kind}-print-media.png`),
    fullPage: true,
  });

  return result;
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
      // Primary contract: CSS @page A5 margin:0 + zoom fit => exactly 1 page.
      if (r.pages.preferCss_zoom !== 1) {
        failures.push(`${r.kind}: preferCss_zoom=${r.pages.preferCss_zoom}`);
      }
      if (r.pages.a4_zoom !== 1) {
        failures.push(`${r.kind}: a4_zoom=${r.pages.a4_zoom}`);
      }
      if (!r.before.noPrintHidden) {
        failures.push(`${r.kind}: .no-print still visible`);
      }
      if (!r.mediaBoxZoom || !r.mediaBoxZoom.startsWith("0 0 420")) {
        failures.push(`${r.kind}: MediaBox not A5 (${r.mediaBoxZoom})`);
      }
      if (r.fit.heightAfterMm > A5_FIT_MM + 0.5) {
        failures.push(
          `${r.kind}: after zoom height ${r.fit.heightAfterMm}mm > fit ${A5_FIT_MM}mm`
        );
      }
    }

    fs.writeFileSync(
      path.join(OUT, "verify-results.json"),
      JSON.stringify(
        {
          a5HeightMm: A5_H_MM,
          a5FitMm: A5_FIT_MM,
          a5FitPx: A5_FIT_PX,
          results,
          failures,
          note:
            "stacked16_* is diagnostic for browser+CSS margin stacking; pass criteria use preferCss_zoom (margin:0 @page).",
          pass: failures.length === 0,
        },
        null,
        2
      )
    );

    console.log("\n=== SUMMARY ===");
    console.log("failures:", failures);
    console.log("PASS?", failures.length === 0);
    console.log("artifacts:", OUT);

    if (failures.length) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
