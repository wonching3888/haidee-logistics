"use client";

import type { ReactNode } from "react";

interface ReportAwaitingQueryProps {
  children?: ReactNode;
}

const DEFAULT_MESSAGE = (
  <>
    请选择筛选条件后点击「查询」加载数据。
    <br />
    Select filters and click Search to load data.
  </>
);

export function ReportAwaitingQuery({ children }: ReportAwaitingQueryProps) {
  return (
    <p className="text-sm text-haidee-muted">{children ?? DEFAULT_MESSAGE}</p>
  );
}
