import { redirect } from "next/navigation";
import { DEFAULT_AUTHED_ROUTE } from "@/lib/routes";
import { getCurrentUser, INACTIVE_SIGN_OUT_PATH } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect(DEFAULT_AUTHED_ROUTE);
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (authUser) {
    redirect(INACTIVE_SIGN_OUT_PATH);
  }

  redirect("/login");
}
