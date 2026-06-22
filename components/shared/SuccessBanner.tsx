"use client";

import { useEffect } from "react";

interface SuccessBannerProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

/** Ephemeral success message — no toast library in the project. */
export function SuccessBanner({
  message,
  onDismiss,
  durationMs = 4000,
}: SuccessBannerProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border border-green-200 bg-green-700 px-4 py-3 text-center text-sm font-medium text-white shadow-lg"
    >
      {message}
    </div>
  );
}
