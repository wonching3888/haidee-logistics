/**
 * Quick sanity check for oklch CSS sanitizer (no browser).
 * Run: npx tsx scripts/_verify-html2canvas-oklch-sanitize.ts
 */
import {
  sanitizeCssTextForHtml2Canvas,
} from "../lib/html2canvas-color-compat";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const sample = `
:root {
  --primary: oklch(0.205 0 0);
  --foreground: oklch(0.145 0 0);
}
.btn {
  background: color-mix(in oklch, var(--secondary), var(--foreground) 5%);
}
`;

const sanitized = sanitizeCssTextForHtml2Canvas(sample);
assert(!sanitized.includes("oklch"), "oklch should be removed");
assert(!sanitized.includes("color-mix"), "color-mix should be removed");
assert(sanitized.includes("--primary:"), "rule structure preserved");

console.log("oklch sanitizer unit check passed");
console.log(sanitized.trim());
