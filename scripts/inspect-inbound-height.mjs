import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const EMAIL = process.env.ADMIN_EMAIL || "admin@haideelogistics.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "haidee2026";
const OUT_DIR = join(process.cwd(), "scripts", "output");

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  await login(page);
  await page.goto(`${BASE_URL}/inbound`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-inbound-table-scroll]", { timeout: 15000 });

  const report = await page.evaluate(() => {
    const scroll = document.querySelector("[data-inbound-table-scroll]");
    const mainScroll = document.querySelector("main > div");
    const vh = window.innerHeight;

    const measure = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
        height: s.height,
        minHeight: s.minHeight,
        flex: s.flex,
        overflow: s.overflow,
        rectHeight: Math.round(r.height),
        rectTop: Math.round(r.top),
        rectBottom: Math.round(r.bottom),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    };

    const scrollBottom = scroll?.getBoundingClientRect().bottom ?? 0;
    const horizontalBarInViewport = scrollBottom <= vh;

    return {
      viewport: vh,
      horizontalBarInViewport,
      scrollContainer: measure(scroll),
      mainScrollArea: measure(mainScroll),
      chain: (() => {
        const items = [];
        let el = scroll;
        while (el) {
          items.push(measure(el));
          el = el.parentElement;
        }
        return items;
      })(),
    };
  });

  writeFileSync(join(OUT_DIR, "height-report.json"), JSON.stringify(report, null, 2));
  await page.screenshot({ path: join(OUT_DIR, "height-verified.png"), fullPage: false });
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.horizontalBarInViewport ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
