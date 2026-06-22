/** Temporary server-side step timings (ms), serialized to browser console for diagnosis. */
export type PerfTimings = Record<string, number>;

export function msSince(start: number): number {
  return Math.round(performance.now() - start);
}

export function createStepTimer() {
  const timings: PerfTimings = {};
  let stepStart = performance.now();

  return {
    mark(label: string) {
      timings[label] = msSince(stepStart);
      stepStart = performance.now();
    },
    timings,
    totalMs() {
      return msSince(stepStart);
    },
  };
}
