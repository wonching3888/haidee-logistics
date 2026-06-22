"use client";

import { useEffect } from "react";
import type { PerfTimings } from "@/lib/perf-timing";

interface InboundTimingsLoggerProps {
  timings: PerfTimings;
}

export function InboundTimingsLogger({ timings }: InboundTimingsLoggerProps) {
  useEffect(() => {
    console.log("[inboundPage timings]", timings);
  }, [timings]);

  return null;
}
