/**
 * Self-test: spouseWorking UI channel + pcbNeedsReview linkage.
 * Does NOT invent permanent spouse_working values for the 11 married drivers
 * (restores after each write check). Syncs pcb_needs_review from current profile.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_selftest-spouse-working-settings.ts
 *
 * Optional UI: BASE_URL=http://localhost:3000 (default) with `npm run dev` running.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import {
  derivePcbNeedsReview,
  normalizeSpouseWorking,
} from "@/lib/driver-pcb-profile";
import { prisma } from "@/lib/prisma";

const OUT = path.join(process.cwd(), "scripts/_output");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const MARRIED_11 = [
  "Akim",
  "Awang",
  "Azhar",
  "Azrin",
  "Faizal",
  "Halim",
  "Ikmal",
  "Own",
  "Pinat",
  "Rozaime",
  "Wan",
] as const;

const SINGLE_3 = ["Din", "Fook", "Naim"] as const;

async function syncPcbNeedsReviewColumn() {
  const drivers = await prisma.driver.findMany({
    select: { id: true, name: true, maritalStatus: true, spouseWorking: true },
  });
  for (const d of drivers) {
    const pcbNeedsReview = derivePcbNeedsReview({
      maritalStatus: d.maritalStatus,
      spouseWorking: d.spouseWorking,
    });
    await prisma.driver.update({
      where: { id: d.id },
      data: { pcbNeedsReview },
    });
  }
  console.log(`Synced pcb_needs_review for ${drivers.length} drivers`);
}

async function applyProfileWrite(input: {
  id: string;
  maritalStatus: string | null;
  spouseWorking: boolean | null;
}) {
  const spouseWorking = normalizeSpouseWorking(input);
  const pcbNeedsReview = derivePcbNeedsReview({
    maritalStatus: input.maritalStatus,
    spouseWorking,
  });
  return prisma.driver.update({
    where: { id: input.id },
    data: { spouseWorking, pcbNeedsReview },
    select: {
      name: true,
      maritalStatus: true,
      spouseWorking: true,
      pcbNeedsReview: true,
    },
  });
}

async function testDbLinkage() {
  console.log("\n=== DB linkage (save path logic) ===");

  const akim = await prisma.driver.findFirstOrThrow({
    where: { name: "Akim" },
    select: {
      id: true,
      maritalStatus: true,
      spouseWorking: true,
      pcbNeedsReview: true,
    },
  });
  if (akim.maritalStatus !== "married") {
    throw new Error("Akim should be married");
  }

  const original = {
    spouseWorking: akim.spouseWorking,
    pcbNeedsReview: akim.pcbNeedsReview,
  };

  try {
    let row = await applyProfileWrite({
      id: akim.id,
      maritalStatus: "married",
      spouseWorking: true,
    });
    if (row.spouseWorking !== true || row.pcbNeedsReview !== false) {
      throw new Error(`Akim spouse=true failed: ${JSON.stringify(row)}`);
    }
    console.log("OK Akim spouseWorking=true → pcbNeedsReview=false");

    row = await applyProfileWrite({
      id: akim.id,
      maritalStatus: "married",
      spouseWorking: false,
    });
    if (row.spouseWorking !== false || row.pcbNeedsReview !== false) {
      throw new Error(`Akim spouse=false failed: ${JSON.stringify(row)}`);
    }
    console.log("OK Akim spouseWorking=false → pcbNeedsReview=false");

    row = await applyProfileWrite({
      id: akim.id,
      maritalStatus: "married",
      spouseWorking: null,
    });
    if (row.spouseWorking !== null || row.pcbNeedsReview !== true) {
      throw new Error(`Akim spouse=null failed: ${JSON.stringify(row)}`);
    }
    console.log("OK Akim spouseWorking=null → pcbNeedsReview=true");
  } finally {
    await applyProfileWrite({
      id: akim.id,
      maritalStatus: "married",
      spouseWorking: original.spouseWorking,
    });
  }

  for (const name of SINGLE_3) {
    const d = await prisma.driver.findFirstOrThrow({
      where: { name },
      select: {
        maritalStatus: true,
        spouseWorking: true,
        pcbNeedsReview: true,
      },
    });
    if (d.maritalStatus !== "single") {
      throw new Error(`${name} expected single`);
    }
    if (d.spouseWorking !== null) {
      throw new Error(`${name} spouseWorking should be null`);
    }
    if (d.pcbNeedsReview !== false) {
      throw new Error(`${name} pcbNeedsReview should be false after sync`);
    }
    console.log(`OK ${name} single → spouseWorking=null pcbNeedsReview=false`);
  }

  for (const name of MARRIED_11) {
    const d = await prisma.driver.findFirstOrThrow({
      where: { name },
      select: {
        maritalStatus: true,
        spouseWorking: true,
        pcbNeedsReview: true,
      },
    });
    if (d.maritalStatus !== "married") {
      throw new Error(`${name} expected married`);
    }
    const expectedReview = d.spouseWorking == null;
    if (d.pcbNeedsReview !== expectedReview) {
      throw new Error(
        `${name} pcbNeedsReview=${d.pcbNeedsReview} expected ${expectedReview}`
      );
    }
    console.log(
      `OK ${name} married spouseWorking=${d.spouseWorking === null ? "NULL" : d.spouseWorking} pcbNeedsReview=${d.pcbNeedsReview}`
    );
  }
}

async function login(page: Page) {
  const email =
    process.env.ADMIN_EMAIL?.trim() || "admin@haideelogistics.com";
  const password = process.env.ADMIN_PASSWORD?.trim() || "haidee2026";

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  // Controlled React inputs: type() fires input events more reliably than fill().
  await page.locator("#email").click();
  await page.locator("#email").press("Control+A");
  await page.locator("#email").type(email, { delay: 10 });
  await page.locator("#password").click();
  await page.locator("#password").press("Control+A");
  await page.locator("#password").type(password, { delay: 10 });
  await page.locator('button[type="submit"]').click();

  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/login")) return;
    const err = await page
      .locator("p")
      .filter({ hasText: /登录失败|Invalid email/ })
      .first()
      .textContent()
      .catch(() => null);
    if (err?.trim()) {
      throw new Error(`Login failed at ${BASE}: ${err.trim()}`);
    }
  }
  throw new Error(`Login timed out at ${BASE} url=${page.url()}`);
}

async function testUi() {
  console.log(`\n=== UI self-test (${BASE}) ===`);
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  try {
    await login(page);
    await page.goto(`${BASE}/settings?section=driver-payroll`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(2000);

    const body = await page.locator("body").innerText();
    if (!body.includes("配偶工作") || !body.includes("PCB资料")) {
      throw new Error("Settings table missing 配偶工作 / PCB资料 columns");
    }
    await page.screenshot({
      path: path.join(OUT, "selftest-spouse-working-table.png"),
      fullPage: true,
    });
    console.log("OK table columns visible");

    // Married: Akim — field visible, save true then restore null
    const akimRow = page.locator("tr", {
      has: page.getByText("Akim", { exact: true }),
    });
    await akimRow.first().getByRole("button").first().click();
    await page.waitForSelector('[role="dialog"]');
    const dialog = page.locator('[role="dialog"]');
    const spouseSelect = dialog.locator("label", {
      hasText: "配偶是否工作",
    }).locator("select");
    if ((await spouseSelect.count()) !== 1) {
      throw new Error("Akim dialog missing spouse working select");
    }
    await page.screenshot({
      path: path.join(OUT, "selftest-spouse-working-akim-dialog.png"),
    });
    console.log("OK Akim dialog shows spouse working field");

    await spouseSelect.selectOption("true");
    await dialog.getByRole("button", { name: "保存" }).click();
    await page.waitForTimeout(3000);

    let akimDb = await prisma.driver.findFirstOrThrow({
      where: { name: "Akim" },
      select: { spouseWorking: true, pcbNeedsReview: true },
    });
    if (akimDb.spouseWorking !== true || akimDb.pcbNeedsReview !== false) {
      throw new Error(`UI save Akim true failed: ${JSON.stringify(akimDb)}`);
    }
    console.log("OK UI save Akim spouseWorking=true pcbNeedsReview=false");

    // Restore null via UI
    await akimRow.first().getByRole("button").first().click();
    await page.waitForSelector('[role="dialog"]');
    await page
      .locator('[role="dialog"]')
      .locator("label", { hasText: "配偶是否工作" })
      .locator("select")
      .selectOption("");
    await page.locator('[role="dialog"]').getByRole("button", { name: "保存" }).click();
    await page.waitForTimeout(3000);
    akimDb = await prisma.driver.findFirstOrThrow({
      where: { name: "Akim" },
      select: { spouseWorking: true, pcbNeedsReview: true },
    });
    if (akimDb.spouseWorking !== null || akimDb.pcbNeedsReview !== true) {
      throw new Error(`UI restore Akim null failed: ${JSON.stringify(akimDb)}`);
    }
    console.log("OK UI restore Akim spouseWorking=null pcbNeedsReview=true");

    // Spot-check remaining married drivers: open dialog, field present
    for (const name of MARRIED_11) {
      if (name === "Akim") continue;
      const row = page.locator("tr", {
        has: page.getByText(name, { exact: true }),
      });
      await row.first().getByRole("button").first().click();
      await page.waitForSelector('[role="dialog"]');
      const count = await page
        .locator('[role="dialog"]')
        .locator("label", { hasText: "配偶是否工作" })
        .count();
      if (count !== 1) {
        throw new Error(`${name} dialog missing spouse working field`);
      }
      await page.locator('[role="dialog"]').getByRole("button", { name: "取消" }).click();
      await page.waitForTimeout(300);
      console.log(`OK ${name} dialog has spouse working field`);
    }

    // Single: Fook — field hidden
    const fookRow = page.locator("tr", {
      has: page.getByText("Fook", { exact: true }),
    });
    await fookRow.first().getByRole("button").first().click();
    await page.waitForSelector('[role="dialog"]');
    const fookSpouse = await page
      .locator('[role="dialog"]')
      .locator("label", { hasText: "配偶是否工作" })
      .count();
    if (fookSpouse !== 0) {
      throw new Error("Fook (single) should hide spouse working field");
    }
    const fookHint = await page
      .locator('[role="dialog"]')
      .getByText("单身无需填写配偶工作状态")
      .count();
    if (fookHint !== 1) {
      throw new Error("Fook dialog missing single hint");
    }
    await page.screenshot({
      path: path.join(OUT, "selftest-spouse-working-fook-dialog.png"),
    });
    await page.locator('[role="dialog"]').getByRole("button", { name: "取消" }).click();
    console.log("OK Fook single hides spouse working field");

    await page.screenshot({
      path: path.join(OUT, "selftest-spouse-working-table-final.png"),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  await syncPcbNeedsReviewColumn();
  await testDbLinkage();

  try {
    await testUi();
  } catch (err) {
    console.error("\nUI self-test failed (is `npm run dev` running on BASE_URL?):");
    console.error(err);
    console.log(
      "\nDB linkage tests passed. Start local dev and re-run for UI screenshots."
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nAll self-tests passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
