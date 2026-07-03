/**
 * Screenshot crate export page cards + historical due date.
 * Run: node --env-file=.env.local --import tsx scripts/_screenshot-crate-export-cards.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { getBangkokTodayDateInput } from "../lib/date-utils";
import { prisma } from "../lib/prisma";

const OUT_DIR = path.join(process.cwd(), "scripts/_output");
const BASE = "http://localhost:3000";

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const today = getBangkokTodayDateInput();
  const historical = await prisma.inboundSession.findFirst({
    where: { status: "confirmed" },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const histDate = historical
    ? historical.date.toISOString().slice(0, 10)
    : today;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  if (page.url().includes("/login")) {
    await page.fill("#email", process.env.ADMIN_EMAIL ?? "admin@haideelogistics.com");
    await page.fill("#password", process.env.ADMIN_PASSWORD ?? "haidee2026");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 60000,
    });
  }

  const urls = [
    { label: "today", url: `${BASE}/crate/export`, out: "crate-export-cards-today.png" },
    {
      label: "historical",
      url: `${BASE}/crate/export?due=${histDate}`,
      out: `crate-export-due-historical-${histDate}.png`,
    },
  ];

  for (const item of urls) {
    try {
      await page.goto(item.url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1500);
      const outPath = path.join(OUT_DIR, item.out);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`${item.label}: ${outPath}`);
    } catch (e) {
      console.warn(`${item.label} skipped (dev server?):`, (e as Error).message);
    }
  }

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
