import { formatDisplayDate } from "@/lib/date-utils";

export const ROWS_PER_PAGE = 22;

export function formatDODate(date: Date): string {
  return formatDisplayDate(date);
}

export function paginateRows<T>(rows: T[], perPage = ROWS_PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(rows.slice(i, i + perPage));
  }
  return pages.length > 0 ? pages : [[]];
}
