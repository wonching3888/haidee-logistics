export function getPageErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "加载失败，请稍后重试 Failed to load data";
}
