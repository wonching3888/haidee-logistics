"use client";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <div className="rounded-xl border border-haidee-red/30 bg-red-50 p-6">
      <p className="font-medium text-haidee-red">页面加载失败 Page load failed</p>
      <p className="mt-1 text-sm text-haidee-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-haidee-blue px-4 py-2 text-sm font-medium text-white hover:bg-haidee-blue/90"
      >
        重试 Retry
      </button>
    </div>
  );
}
