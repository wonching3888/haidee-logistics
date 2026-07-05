/**
 * Static UI preview screenshots for spouseWorking settings wiring
 * (no auth required). Mirrors labels/structure of Settings driver form/table.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_preview-spouse-working-ui.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";
import { derivePcbNeedsReview } from "@/lib/driver-pcb-profile";

const OUT = path.join(process.cwd(), "scripts/_output");

const JUNE_14 = [
  "Akim",
  "Awang",
  "Azhar",
  "Azrin",
  "Din",
  "Faizal",
  "Fook",
  "Halim",
  "Ikmal",
  "Naim",
  "Own",
  "Pinat",
  "Rozaime",
  "Wan",
] as const;

function spouseLabel(maritalStatus: string | null, spouseWorking: boolean | null) {
  if (maritalStatus !== "married") return "—";
  if (spouseWorking === true) return "是";
  if (spouseWorking === false) return "否";
  return "待填";
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const drivers = await prisma.driver.findMany({
    where: { name: { in: [...JUNE_14] } },
    orderBy: { name: "asc" },
    select: {
      name: true,
      fullName: true,
      maritalStatus: true,
      spouseWorking: true,
      childCount: true,
      pcbNeedsReview: true,
    },
  });

  const rows = drivers
    .map((d) => {
      const review = derivePcbNeedsReview({
        maritalStatus: d.maritalStatus,
        spouseWorking: d.spouseWorking,
      });
      return `<tr>
        <td><b>${d.name}</b></td>
        <td>${d.fullName ?? "—"}</td>
        <td>${d.maritalStatus ?? "—"} / ${d.childCount}</td>
        <td>${spouseLabel(d.maritalStatus, d.spouseWorking)}</td>
        <td><span class="badge ${review ? "pending" : "ok"}">${review ? "待补" : "齐全"}</span></td>
      </tr>`;
    })
    .join("\n");

  const tableHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
body{font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;color:#0f172a}
h1{font-size:20px;margin:0 0 8px}
p{color:#64748b;font-size:13px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e2e8f0}
th,td{border-bottom:1px solid #e2e8f0;padding:10px 12px;text-align:left;font-size:13px}
th{background:#f1f5f9}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px}
.badge.pending{background:#e2e8f0;color:#334155}
.badge.ok{background:#1d4ed8;color:#fff}
</style></head><body>
<h1>司机资料 Driver Master — 配偶工作 / PCB资料</h1>
<p>Live DB snapshot (14 June cohort). Married drivers show 待填 until spouseWorking is entered.</p>
<table>
<thead><tr><th>小名</th><th>全名</th><th>婚姻/子女</th><th>配偶工作</th><th>PCB资料</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

  const marriedDialogHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
body{font-family:system-ui,sans-serif;background:#0f172a66;padding:40px}
.dialog{background:#fff;border-radius:12px;max-width:520px;margin:0 auto;padding:24px;box-shadow:0 10px 40px #0003}
h2{margin:0 0 16px;font-size:18px}
label{display:block;font-size:13px;margin-bottom:12px}
select,input{display:block;width:100%;margin-top:4px;min-height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font-size:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.note{font-size:12px;color:#64748b}
</style></head><body>
<div class="dialog">
  <h2>编辑司机 Edit Driver — Akim（已婚）</h2>
  <div class="grid">
    <label>婚姻状况 Marital Status
      <select><option selected>已婚 Married</option></select>
    </label>
    <label>配偶是否工作 Spouse working
      <select>
        <option selected>— 待填</option>
        <option>是 Yes（配偶有工作）</option>
        <option>否 No（配偶无工作）</option>
      </select>
    </label>
  </div>
  <p class="note">仅婚姻状况=已婚时显示/可编辑。保存后自动更新 pcbNeedsReview。</p>
</div>
</body></html>`;

  const singleDialogHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
body{font-family:system-ui,sans-serif;background:#0f172a66;padding:40px}
.dialog{background:#fff;border-radius:12px;max-width:520px;margin:0 auto;padding:24px;box-shadow:0 10px 40px #0003}
h2{margin:0 0 16px;font-size:18px}
label{display:block;font-size:13px;margin-bottom:12px}
select{display:block;width:100%;margin-top:4px;min-height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font-size:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.hint{font-size:13px;color:#64748b;align-self:end;padding-bottom:12px}
</style></head><body>
<div class="dialog">
  <h2>编辑司机 Edit Driver — Fook（单身）</h2>
  <div class="grid">
    <label>婚姻状况 Marital Status
      <select><option selected>未婚 Single</option></select>
    </label>
    <div class="hint">单身无需填写配偶工作状态</div>
  </div>
</div>
</body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });

  const tablePath = path.join(OUT, "selftest-spouse-working-table.png");
  await page.setContent(tableHtml, { waitUntil: "load" });
  await page.screenshot({ path: tablePath, fullPage: true });
  console.log("Wrote", tablePath);

  const marriedPath = path.join(OUT, "selftest-spouse-working-akim-dialog.png");
  await page.setContent(marriedDialogHtml, { waitUntil: "load" });
  await page.screenshot({ path: marriedPath, fullPage: true });
  console.log("Wrote", marriedPath);

  const singlePath = path.join(OUT, "selftest-spouse-working-fook-dialog.png");
  await page.setContent(singleDialogHtml, { waitUntil: "load" });
  await page.screenshot({ path: singlePath, fullPage: true });
  console.log("Wrote", singlePath);

  await browser.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
