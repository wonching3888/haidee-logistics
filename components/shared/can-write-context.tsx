"use client";

import { createContext, useContext } from "react";

const CanWriteContext = createContext(false);

export function CanWriteProvider({
  canWrite,
  children,
}: {
  canWrite: boolean;
  children: React.ReactNode;
}) {
  return (
    <CanWriteContext.Provider value={canWrite}>{children}</CanWriteContext.Provider>
  );
}

/** Whether the current user may perform business write actions (server-derived). */
export function useCanWrite(): boolean {
  return useContext(CanWriteContext);
}
