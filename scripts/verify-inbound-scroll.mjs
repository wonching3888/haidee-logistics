import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const EMAIL = process.env.ADMIN_EMAIL || "admin@haideelogistics.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "haidee2026";
const OUT_DIR = join(process.cwd(), "scripts", "output");

async function login(page) {
  await page.goto(`${BASE_URL}/inbound`, { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/login")) return;
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20000,
  });
}

async function inspectOverflowChain(page) {
  return page.evaluate(() => {
    const table = document.querySelector("main table");
    if (!table) return { error: "No table found" };

    const chain = [];
    let el = table;
    while (el) {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      chain.push({
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className : "",
        dataset: el.dataset?.inboundTableScroll ? "inbound-table-scroll" : "",
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        touchAction: style.touchAction,
        width: Math.round(rect.width),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        canScrollX: el.scrollWidth > el.clientWidth,
      });
      el = el.parentElement;
    }
    return { chain };
  });
}

async function testTableScroll(page) {
  return page.evaluate(() => {
    const scrollEl = document.querySelector("[data-inbound-table-scroll]");
    if (!scrollEl) return { error: "No [data-inbound-table-scroll] element" };

    const style = getComputedStyle(scrollEl);
    const before = scrollEl.scrollLeft;
    scrollEl.scrollLeft = 250;
    const after = scrollEl.scrollLeft;
    scrollEl.scrollLeft = before;

    return {
      overflowX: style.overflowX,
      touchAction: style.touchAction,
      scrollWidth: scrollEl.scrollWidth,
      clientWidth: scrollEl.clientWidth,
      scrollLeftAfter: after,
      scrollWorked: after > before,
    };
  });
}

async function testTouchSwipe(page) {
  const scroll = page.locator("[data-inbound-table-scroll]");
  await scroll.waitFor({ state: "visible" });
  const box = await scroll.boundingBox();
  if (!box) return { error: "No scroll box" };

  const before = await scroll.evaluate((el) => el.scrollLeft);
  const startX = box.x + box.width * 0.75;
  const startY = box.y + box.height * 0.5;
  const endX = box.x + box.width * 0.25;

  await page.touchscreen.tap(startX, startY);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, startY, { steps: 15 });
  await page.mouse.up();

  const after = await scroll.evaluate((el) => el.scrollLeft);
  return { before, after, touchWorked: after > before };
}

async function renderOverflowOverlay(page) {
  await page.evaluate(() => {
    const old = document.getElementById("overflow-debug-overlay");
    old?.remove();

    const table = document.querySelector("main table");
    if (!table) return;

    const panel = document.createElement("div");
    panel.id = "overflow-debug-overlay";
    panel.style.cssText =
      "position:fixed;top:8px;right:8px;z-index:99999;background:#111;color:#fff;padding:12px;font:12px/1.4 monospace;max-height:90vh;overflow:auto;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.4)";

    const title = document.createElement("div");
    title.textContent = "Computed overflow-x chain (table → html)";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    panel.appendChild(title);

    let el = table;
    let i = 0;
    while (el) {
      const style = getComputedStyle(el);
      const line = document.createElement("div");
      const label = `${i}. <${el.tagName.toLowerCase()}>`;
      const cls =
        typeof el.className === "string" && el.className
          ? `.${el.className.split(" ").slice(0, 2).join(".")}`
          : el.dataset?.inboundTableScroll
            ? "[data-inbound-table-scroll]"
            : "";
      line.textContent = `${label}${cls} → overflow-x: ${style.overflowX} | ${el.clientWidth}/${el.scrollWidth}px`;
      if (el.scrollWidth > el.clientWidth) line.style.color = "#7dffb3";
      panel.appendChild(line);
      el = el.parentElement;
      i += 1;
    }

    document.body.appendChild(panel);
  });
}

async function runViewport(width) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto(`${BASE_URL}/inbound`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-inbound-table-scroll]", { timeout: 15000 });

    const inspection = await inspectOverflowChain(page);
    const scrollTest = await testTableScroll(page);
    const touchTest = await testTouchSwipe(page);

    await renderOverflowOverlay(page);
    await page.screenshot({
      path: join(OUT_DIR, `overflow-verified-${width}.png`),
      fullPage: false,
    });

    const report = {
      viewport: { width, height: 844 },
      inspection,
      scrollTest,
      touchTest,
      passed: scrollTest.scrollWorked === true,
    };

    writeFileSync(
      join(OUT_DIR, `overflow-report-${width}.json`),
      JSON.stringify(report, null, 2)
    );

    console.log(`\n=== viewport ${width}px ===`);
    console.log(JSON.stringify(report, null, 2));

    return report.passed;
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const widths = [390, 768];
  let allOk = true;
  for (const width of widths) {
    const ok = await runViewport(width);
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
