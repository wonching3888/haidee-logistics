/**
 * Automated A5 landscape PV/RV print verification — 5 slots/page, no zoom fit.
 *
 * Asserts:
 *   - page count = ceil(lineCount / 5) (empty → 1)
 *   - each PDF page MediaBox is A5 landscape (~595×420 pt)
 *   - non-last pages: no total / words / signatures
 *   - last page: has total + words + signatures; slots padded to 5
 *
 * Fixtures: 1 line, 5 lines, 6 lines (→ 2 pages).
 *
 * Run: npx tsx scripts/_verify-pv-a5-print.ts
 * Exit 0 only when all asserts pass.
 * Artifacts: .tmp-screenshots/pv-a5-land-{1|5|6}line.{pdf,png}
 *
 * ---------------------------------------------------------------------------
 * PHYSICAL PRINT PITFALL (RICOH IM 2702 / this office queue) — 2026-07-16
 * ---------------------------------------------------------------------------
 * A5 landscape PDF MediaBox alone is NOT enough for correct physical output.
 * This printer's default orientation-requested is portrait; without an explicit
 * landscape flag the driver maps the 210mm-wide page onto the 148mm axis and
 * the print is clipped ("打印被截").
 *
 * When sending to the bypass tray (A5, long-edge-first / LEF), always include:
 *   -o orientation-requested=4
 * together with:
 *   -o media=iso_a5_148x210mm -o PageSize=A5 -o InputSlot=manual
 *   -o print-scaling=none -o fit-to-page=false -o sides=one-sided
 *
 * Do not rely on PDF MediaBox / @page landscape to set printer orientation.
 * ---------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { expectedVoucherPrintPageCount } from "../lib/cash-book/voucher-print-pages";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".tmp-screenshots");
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

/** A5 landscape in PDF points (210mm × 148mm). */
const A5_LAND_W_PT = 595.28;
const A5_LAND_H_PT = 419.53;
const A5_LAND_H_MM = 148;
/** Soft ceiling for last-page content height (padding included). Usable ≈138mm. */
const LAST_PAGE_HEIGHT_MM_MAX = 128;

type CaseName = "1line" | "5line" | "6line";

const CASES: Record<CaseName, number> = {
  "1line": 1,
  "5line": 5,
  "6line": 6,
};

function countPdfPages(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page(?!\w)/g) ?? []).length;
}

function parseMediaBoxes(buf: Buffer): string[] {
  return [
    ...buf.toString("latin1").matchAll(/\/MediaBox\s*\[\s*([0-9.\s]+)\]/g),
  ].map((m) => m[1].trim());
}

function isA5LandscapeMediaBox(box: string): boolean {
  const parts = box.split(/\s+/).map(Number);
  if (parts.length !== 4) return false;
  const [, , w, h] = parts;
  return Math.abs(w - A5_LAND_W_PT) < 4 && Math.abs(h - A5_LAND_H_PT) < 4;
}

function sampleLines(n: number): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (let i = 1; i <= n; i++) {
    const long =
      i === 6
        ? `Line ${i} / รายการที่ ${i} — long wrap check fuel + allowance SONGKHLA → PATTANI`
        : `Line ${i} / รายการที่ ${i} THONGDANG trip`;
    rows.push([
      long,
      `${(i * 100 + 0.5).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ]);
  }
  return rows;
}

function padSlots(
  pageLines: Array<[string, string]>
): Array<[string, string] | null> {
  const slots: Array<[string, string] | null> = [...pageLines];
  while (slots.length < 5) slots.push(null);
  return slots.slice(0, 5);
}

function buildPageHtml(opts: {
  pageNum: number;
  pageCount: number;
  pageLines: Array<[string, string]>;
  isLast: boolean;
  total: string;
  words: string;
}): string {
  const { pageNum, pageCount, pageLines, isLast, total, words } = opts;
  const slots = padSlots(pageLines);
  const pageLabel =
    pageCount > 1
      ? `<p class="payment-voucher-page-label">หน้า ${pageNum}/${pageCount}</p>`
      : "";
  const slotRows = slots
    .map((slot, idx) => {
      const empty = slot ? "0" : "1";
      const p = slot ? slot[0] : "&nbsp;";
      const a = slot ? slot[1] : "&nbsp;";
      return `<tr class="payment-voucher-slot-row" data-empty="${empty}" data-slot="${idx}">
        <td class="payment-voucher-slot-particulars">${p}</td>
        <td class="payment-voucher-amount-col text-right font-mono whitespace-nowrap">${a}</td>
      </tr>`;
    })
    .join("");
  const totalRow = isLast
    ? `<tr class="payment-voucher-total-row font-bold">
        <td class="text-right">รวม / Total</td>
        <td class="payment-voucher-amount-col text-right font-mono">${total}</td>
      </tr>`
    : "";
  const footer = isLast
    ? `<div class="payment-voucher-words" data-voucher-words="1">
        <span class="font-medium payment-voucher-words-label">จำนวนเงิน (ตัวอักษร) / Amount in words:</span>
        <span class="payment-voucher-amount-words">${words}</span>
      </div>
      <div class="payment-voucher-signatures" style="grid-template-columns:repeat(3,minmax(0,1fr))" data-voucher-signatures="1">
        <div><div class="payment-voucher-sig-line"></div><p class="payment-voucher-sig-label">ผู้รับเงิน / Payee</p><p class="payment-voucher-sig-name">Payee Name</p></div>
        <div><div class="payment-voucher-sig-line"></div><p class="payment-voucher-sig-label">ผู้จัดทำ / Prepared by</p><p class="payment-voucher-sig-name">Clerk</p></div>
        <div><div class="payment-voucher-sig-line"></div><p class="payment-voucher-sig-label">ผู้อนุมัติ / Approved by</p><p class="payment-voucher-sig-name">Manager</p></div>
      </div>`
    : `<p class="payment-voucher-continued" data-voucher-continued="1">— ต่อหน้าถัดไป / continued —</p>`;

  return `<div
    class="document-print payment-voucher-print payment-voucher-print-page ${isLast ? "is-last-page" : ""} rounded-lg border bg-white p-6"
    data-voucher-print-page="${pageNum}"
    data-voucher-print-page-count="${pageCount}"
    data-voucher-print-is-last="${isLast ? "1" : "0"}"
    data-voucher-print-orientation="landscape"
  >
    <header class="payment-voucher-topband">
      <div class="payment-voucher-topband-company">
        <img class="haidee-invoice-letterhead-logo payment-voucher-topband-logo" src="${LOGO}" alt="Logo"/>
        <div class="payment-voucher-topband-company-text">
          <div class="haidee-invoice-letterhead-name-th">บริษัท ไฮดี โลจิสติกส์ จำกัด</div>
          <div class="haidee-invoice-letterhead-name-en">HAI DEE LOGISTICS CO., LTD.</div>
          <div class="haidee-invoice-letterhead-detail">38/88 หมู่1 ถ.กาญจนวนิช ต.สำนักขาม อ.สะเดา จ.สงขลา 90320</div>
          <div class="haidee-invoice-letterhead-detail">เลขประจำตัวผู้เสียภาษี 0905567001730</div>
        </div>
      </div>
      <h1 class="payment-voucher-title"><span>ใบสำคัญจ่าย / Payment Voucher</span></h1>
      <div class="payment-voucher-topband-right">
        <p><span class="font-medium">เลขที่ / Voucher No.</span></p>
        <p class="font-mono payment-voucher-topband-voucher-no">PV-VERIFY-${pageCount}P</p>
        ${pageLabel}
      </div>
    </header>
    <div class="payment-voucher-meta">
      <p><span class="font-medium">วันที่ / Date:</span> 15/07/2026</p>
      <p class="payment-voucher-meta-party"><span class="font-medium">จ่ายให้ / Paid To:</span> THONGDANG LOGISTICS PARTNER CO., LTD.</p>
      <p><span class="font-medium">วิธีชำระ / Payment Method:</span> โอนเงิน / Transfer</p>
      <p><span class="font-medium">วันครบกำหนด / Due Date:</span> 20/07/2026</p>
    </div>
    <table class="payment-voucher-table">
      <thead>
        <tr>
          <th class="text-left">รายละเอียด / Particulars</th>
          <th class="payment-voucher-amount-col text-right whitespace-nowrap">จำนวนเงิน / Amount (THB)</th>
        </tr>
      </thead>
      <tbody>
        ${slotRows}
        ${totalRow}
      </tbody>
    </table>
    ${footer}
  </div>`;
}

function buildHtml(lineCount: number): string {
  const all = sampleLines(lineCount);
  const pageCount = expectedVoucherPrintPageCount(lineCount);
  const pages: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    const slice = all.slice(i * 5, i * 5 + 5);
    pages.push(
      buildPageHtml({
        pageNum: i + 1,
        pageCount,
        pageLines: slice,
        isLast: i === pageCount - 1,
        total: all
          .reduce((s, [, a]) => s + Number(a.replace(/,/g, "")), 0)
          .toLocaleString("en-US", { minimumFractionDigits: 2 }),
        words:
          "หนึ่งพันสองร้อยบาทถ้วน / One Thousand Two Hundred Baht Only",
      })
    );
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,"Noto Sans Thai",Tahoma,sans-serif}
.text-right{text-align:right}.text-left{text-align:left}.text-center{text-align:center}
.font-bold{font-weight:700}.font-medium{font-weight:500}.font-mono{font-family:ui-monospace,monospace}
.bg-white{background:#fff}.border{border:1px solid #d1d5db}.rounded-lg{border-radius:.5rem}
.p-6{padding:1.5rem}.whitespace-nowrap{white-space:nowrap}
.no-print{display:block}.flex{display:flex}.h-screen{height:100vh}
${CSS_GLOBAL_PRINT}
${CSS_DOC}
${CSS_PV}
</style></head>
<body>
<div class="flex h-screen" style="overflow:hidden">
  <div class="no-print">SIDEBAR</div>
  <main style="flex:1;overflow:auto;padding:1.5rem">
    <div class="space-y-4">
      <div class="no-print">TOOLBAR Print</div>
      <div class="payment-voucher-print-stack">${pages.join("\n")}</div>
    </div>
  </main>
</div>
</body></html>`;
}

async function runCase(page: Page, kind: CaseName) {
  const lineCount = CASES[kind];
  const expectedPages = expectedVoucherPrintPageCount(lineCount);
  await page.setContent(buildHtml(lineCount), { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });

  const dom = await page.evaluate(() => {
    const pages = [
      ...document.querySelectorAll<HTMLElement>("[data-voucher-print-page]"),
    ];
    return pages.map((el) => {
      const h = el.getBoundingClientRect().height;
      return {
        page: Number(el.dataset.voucherPrintPage),
        isLast: el.dataset.voucherPrintIsLast === "1",
        orientation: el.dataset.voucherPrintOrientation ?? "",
        slotCount: el.querySelectorAll(".payment-voucher-slot-row").length,
        emptySlots: el.querySelectorAll(
          '.payment-voucher-slot-row[data-empty="1"]'
        ).length,
        hasTotal: !!el.querySelector(".payment-voucher-total-row"),
        hasWords: !!el.querySelector("[data-voucher-words]"),
        hasSignatures: !!el.querySelector("[data-voucher-signatures]"),
        hasContinued: !!el.querySelector("[data-voucher-continued]"),
        hasTopband: !!el.querySelector(".payment-voucher-topband"),
        heightMm: +(h / (96 / 25.4)).toFixed(2),
        pageCss: getComputedStyle(el).page,
        zoom: (el.style as CSSStyleDeclaration & { zoom?: string }).zoom || "",
      };
    });
  });

  const pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  const mediaBoxes = parseMediaBoxes(pdf);
  const pdfPages = countPdfPages(pdf);

  const pdfPath = path.join(OUT, `pv-a5-land-${kind}.pdf`);
  const pngPath = path.join(OUT, `pv-a5-land-${kind}-print.png`);
  fs.writeFileSync(pdfPath, pdf);
  await page.screenshot({ path: pngPath, fullPage: true });

  return {
    kind,
    lineCount,
    expectedPages,
    pdfPages,
    mediaBoxes,
    dom,
    pdfPath,
    pngPath,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1100, height: 900 },
  });

  const results = [];
  const failures: string[] = [];
  try {
    for (const kind of Object.keys(CASES) as CaseName[]) {
      const r = await runCase(page, kind);
      results.push(r);
      console.log(JSON.stringify(r, null, 2));

      if (r.pdfPages !== r.expectedPages) {
        failures.push(
          `${kind}: pdfPages=${r.pdfPages} expected ${r.expectedPages}`
        );
      }
      if (r.dom.length !== r.expectedPages) {
        failures.push(
          `${kind}: dom pages=${r.dom.length} expected ${r.expectedPages}`
        );
      }
      if (r.mediaBoxes.length < r.expectedPages) {
        failures.push(
          `${kind}: MediaBox count ${r.mediaBoxes.length} < ${r.expectedPages}`
        );
      }
      for (let i = 0; i < Math.min(r.mediaBoxes.length, r.expectedPages); i++) {
        if (!isA5LandscapeMediaBox(r.mediaBoxes[i]!)) {
          failures.push(
            `${kind}: page ${i + 1} MediaBox not A5 landscape (${r.mediaBoxes[i]})`
          );
        }
      }

      for (const p of r.dom) {
        if (p.orientation !== "landscape") {
          failures.push(`${kind}: page ${p.page} orientation=${p.orientation}`);
        }
        if (!p.hasTopband) {
          failures.push(`${kind}: page ${p.page} missing topband`);
        }
        if (p.slotCount !== 5) {
          failures.push(`${kind}: page ${p.page} slots=${p.slotCount} (want 5)`);
        }
        if (p.zoom && p.zoom !== "1" && p.zoom !== "normal") {
          failures.push(`${kind}: page ${p.page} unexpected zoom=${p.zoom}`);
        }
        if (p.isLast) {
          if (!p.hasTotal || !p.hasWords || !p.hasSignatures) {
            failures.push(`${kind}: last page missing total/words/signatures`);
          }
          if (p.hasContinued) {
            failures.push(`${kind}: last page should not show continued`);
          }
          if (p.heightMm > LAST_PAGE_HEIGHT_MM_MAX) {
            failures.push(
              `${kind}: last page height ${p.heightMm}mm > ${LAST_PAGE_HEIGHT_MM_MAX}mm (tighten; no zoom)`
            );
          }
        } else {
          if (p.hasTotal || p.hasWords || p.hasSignatures) {
            failures.push(
              `${kind}: non-last page ${p.page} must not have total/words/signatures`
            );
          }
          if (!p.hasContinued) {
            failures.push(`${kind}: non-last page ${p.page} missing continued`);
          }
        }
      }

      if (kind === "1line" && r.dom[0]?.emptySlots !== 4) {
        failures.push(`1line: emptySlots=${r.dom[0]?.emptySlots} want 4`);
      }
      if (kind === "5line" && r.dom[0]?.emptySlots !== 0) {
        failures.push(`5line: emptySlots=${r.dom[0]?.emptySlots} want 0`);
      }
      if (kind === "6line") {
        if (r.dom[0]?.emptySlots !== 0) {
          failures.push(`6line p1: emptySlots=${r.dom[0]?.emptySlots} want 0`);
        }
        if (r.dom[1]?.emptySlots !== 4) {
          failures.push(`6line p2: emptySlots=${r.dom[1]?.emptySlots} want 4`);
        }
      }
    }

    const pass = failures.length === 0;
    fs.writeFileSync(
      path.join(OUT, "pv-a5-land-verify-results.json"),
      JSON.stringify(
        {
          a5LandscapeHeightMm: A5_LAND_H_MM,
          usableHeightMmApprox: A5_LAND_H_MM - 10,
          lastPageHeightMmMax: LAST_PAGE_HEIGHT_MM_MAX,
          linesPerPage: 5,
          results,
          failures,
          note:
            "A5 landscape only; 5 slots/page; no voucher-print-fit zoom.",
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
