/**
 * Shadow diff logging (Step 5). Collects legacy vs next-model diffs;
 * production output always stays on legacy until enforced.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface TripCostShadowDiff {
  tripId: string;
  scope: "voucher" | "vehicle" | "unload";
  field: string;
  legacyMyr: number;
  nextMyr: number;
  deltaMyr: number;
}

export interface ShadowLoggerOptions {
  /** JSONL output path; defaults to artifacts/cost-shadow-diffs.jsonl */
  outputPath?: string;
  /** When true, also console.log each diff (snapshot scripts). */
  verbose?: boolean;
}

let buffer: TripCostShadowDiff[] = [];
let outputPath = join(process.cwd(), "artifacts", "cost-shadow-diffs.jsonl");
let verbose = false;
let sessionStarted = false;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function configureShadowLogger(options: ShadowLoggerOptions = {}) {
  if (options.outputPath) outputPath = options.outputPath;
  if (options.verbose != null) verbose = options.verbose;
}

export function resetShadowLoggerBuffer() {
  buffer = [];
  sessionStarted = false;
}

export function getShadowLoggerBuffer(): readonly TripCostShadowDiff[] {
  return buffer;
}

export function logTripCostShadowDiff(diff: TripCostShadowDiff): void {
  const normalized: TripCostShadowDiff = {
    ...diff,
    legacyMyr: roundMoney(diff.legacyMyr),
    nextMyr: roundMoney(diff.nextMyr),
    deltaMyr: roundMoney(diff.nextMyr - diff.legacyMyr),
  };
  buffer.push(normalized);
  if (verbose) {
    console.log(
      `[shadow] ${normalized.tripId} ${normalized.scope}.${normalized.field}: ` +
        `legacy=${normalized.legacyMyr} next=${normalized.nextMyr} Δ=${normalized.deltaMyr}`
    );
  }
}

export function logTripCostShadowDiffs(diffs: TripCostShadowDiff[]): void {
  for (const diff of diffs) {
    logTripCostShadowDiff(diff);
  }
}

/** Persist buffered diffs as JSONL (append). Clears buffer after flush. */
export function flushShadowLoggerBuffer(meta?: Record<string, unknown>) {
  if (buffer.length === 0 && !meta) return;

  mkdirSync(dirname(outputPath), { recursive: true });
  if (meta) {
    appendFileSync(
      outputPath,
      `${JSON.stringify({ type: "meta", at: new Date().toISOString(), ...meta })}\n`,
      "utf8"
    );
  }
  for (const diff of buffer) {
    appendFileSync(
      outputPath,
      `${JSON.stringify({ type: "diff", ...diff })}\n`,
      "utf8"
    );
  }
  buffer = [];
}

/**
 * Shadow mode: compute both paths, log diffs, return legacy value for production output.
 */
export function selectShadowOutput<T extends number>(
  tripId: string,
  scope: TripCostShadowDiff["scope"],
  field: string,
  legacyMyr: number,
  nextMyr: number
): T {
  if (Math.abs(legacyMyr - nextMyr) > 0.001) {
    logTripCostShadowDiff({
      tripId,
      scope,
      field,
      legacyMyr,
      nextMyr,
      deltaMyr: nextMyr - legacyMyr,
    });
  }
  return legacyMyr as T;
}

export function beginShadowSession(label: string) {
  sessionStarted = true;
  flushShadowLoggerBuffer({ event: "session_start", label });
}

export function endShadowSession(label: string, summary?: Record<string, unknown>) {
  flushShadowLoggerBuffer({ event: "session_end", label, ...summary });
  sessionStarted = false;
}

export function isShadowSessionActive() {
  return sessionStarted;
}
