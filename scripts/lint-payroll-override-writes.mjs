/**
 * CI guard: scripts/ must not bare-write payroll override columns on driver_payroll_months.
 * Audited path: lib/payroll-override-write.ts → applyPayrollOverridePatch
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCRIPTS_DIR = join(ROOT, "scripts");
const OVERRIDE_KEYS = [
  "epfEmployeeOverride",
  "epfEmployerOverride",
  "socsoEmployeeOverride",
  "socsoEmployerOverride",
  "lindung24JamOverride",
  "eisEmployeeOverride",
  "eisEmployerOverride",
  "pcbOverride",
];
const UPDATE_RE = /driverPayrollMonth\.(update|upsert)\s*\(/g;
const READONLY_SUFFIX = /-readonly\.ts$/;

function walkTsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "_output") continue;
      walkTsFiles(full, out);
    } else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function relative(path) {
  return path.replace(ROOT + "\\", "").replace(ROOT + "/", "");
}

const violations = [];

for (const file of walkTsFiles(SCRIPTS_DIR)) {
  const rel = relative(file);
  if (READONLY_SUFFIX.test(rel)) continue;
  if (rel === "scripts/lint-payroll-override-writes.mjs") continue;

  const text = readFileSync(file, "utf8");
  if (!UPDATE_RE.test(text)) continue;
  UPDATE_RE.lastIndex = 0;

  for (const match of text.matchAll(UPDATE_RE)) {
    const start = match.index ?? 0;
    const window = text.slice(start, start + 800);
    const hitKeys = OVERRIDE_KEYS.filter((key) => window.includes(key));
    if (hitKeys.length === 0) continue;
    violations.push({ file: rel, keys: hitKeys });
  }
}

if (violations.length > 0) {
  console.error(
    "payroll-override lint failed: bare driverPayrollMonth override writes in scripts/\n"
  );
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.keys.join(", ")}`);
  }
  console.error(
    "\nUse applyPayrollOverridePatch from lib/payroll-override-write.ts instead."
  );
  process.exit(1);
}

console.log("payroll-override lint OK (no bare override writes in scripts/)");
