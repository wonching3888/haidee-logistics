/**
 * Verify Dashboard WTL PDF via real Share button (uses app html2canvas + compat fix).
 * Run: node scripts/_verify-dashboard-wtl-pdf-capture.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "scripts/_output");
const OUT_PDF = path.join(OUT_DIR, "wtl-daily-share-test.pdf");

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    await page.fill("#email", "admin@haideelogistics.com");
    await page.fill("#password", "haidee2026");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await login(page);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

    const domMetrics = await page.evaluate(() => {
      const root = document.querySelector("[data-pdf-capture-root]");
      const scrollEl = root?.querySelector(".scroll-matrix-table");
      const bodyRows = root?.querySelectorAll(".daily-summary-table tbody tr").length ?? 0;
      const hasTotal = !!root?.querySelector(".daily-summary-total-row");
      return {
        hasRoot: !!root,
        bodyRows,
        hasTotal,
        scrollClientHeight: scrollEl?.clientHeight ?? 0,
        scrollScrollHeight: scrollEl?.scrollHeight ?? 0,
        isClipped: (scrollEl?.scrollHeight ?? 0) > (scrollEl?.clientHeight ?? 0) + 2,
      };
    });

    console.log("DOM metrics:", JSON.stringify(domMetrics, null, 2));

    if (!domMetrics.hasRoot || domMetrics.bodyRows === 0 || !domMetrics.hasTotal) {
      throw new Error("Dashboard WTL table missing or incomplete");
    }

    const shareButton = page.getByRole("button", { name: /分享 PDF/ });
    await shareButton.waitFor({ state: "visible", timeout: 15000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await shareButton.click();
    const download = await downloadPromise;
    await download.saveAs(OUT_PDF);

    const stat = fs.statSync(OUT_PDF);
    const header = fs.readFileSync(OUT_PDF).subarray(0, 8).toString("utf8");
    const pageCountMatch = fs
      .readFileSync(OUT_PDF)
      .toString("latin1")
      .match(/\/Type\s*\/Page[^s]/g);

    console.log("\n--- PDF file check ---");
    console.log("Path:", OUT_PDF);
    console.log("Size bytes:", stat.size);
    console.log("Header:", header);
    console.log("Estimated pages:", pageCountMatch?.length ?? "unknown");

    if (!header.startsWith("%PDF")) {
      throw new Error("Download is not a valid PDF");
    }

    if (stat.size < 25_000) {
      throw new Error(
        `PDF too small (${stat.size} bytes) — likely letterhead-only capture`
      );
    }

    console.log("\n✅ Dashboard WTL share PDF verification passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
