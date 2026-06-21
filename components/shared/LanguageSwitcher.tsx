"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserLanguage } from "@/app/actions/user-language";
import { cn } from "@/lib/utils";
import type { UserLanguage } from "@/types";

interface LanguageSwitcherProps {
  current: UserLanguage;
}

export function LanguageSwitcher({ current }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLanguage(language: UserLanguage) {
    if (language === current || isPending) return;
    startTransition(async () => {
      await updateUserLanguage(language);
      router.refresh();
    });
  }

  return (
    <div
      className="flex shrink-0 rounded-lg border border-haidee-border bg-haidee-surface p-0.5 text-xs"
      role="group"
      aria-label="界面语言 UI language"
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => selectLanguage("zh")}
        className={cn(
          "min-h-[36px] rounded-md px-2.5 font-medium transition-colors",
          current === "zh"
            ? "bg-white text-haidee-text shadow-sm"
            : "text-haidee-muted hover:text-haidee-text"
        )}
      >
        中文
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => selectLanguage("th")}
        className={cn(
          "min-h-[36px] rounded-md px-2.5 font-medium transition-colors",
          current === "th"
            ? "bg-white text-haidee-text shadow-sm"
            : "text-haidee-muted hover:text-haidee-text"
        )}
      >
        ไทย
      </button>
    </div>
  );
}
