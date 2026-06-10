import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/login";
const out = process.argv[3] ?? "login-screenshot.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`Screenshot saved: ${out}`);
