"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import type { UserLanguage } from "@/types";

export async function updateUserLanguage(language: UserLanguage) {
  const user = await requireUser();

  if (language !== "zh" && language !== "th") {
    throw new Error("无效语言 Invalid language");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { language },
  });

  revalidatePath("/", "layout");
}
