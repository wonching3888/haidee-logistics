import { redirect } from "next/navigation";
import { DEFAULT_AUTHED_ROUTE } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? DEFAULT_AUTHED_ROUTE : "/login");
}
