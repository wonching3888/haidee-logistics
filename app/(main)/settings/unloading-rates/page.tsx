import { redirect } from "next/navigation";
import { settingsSectionHref } from "@/lib/constants/settings-nav";

export default function UnloadingRatesRedirectPage() {
  redirect(settingsSectionHref("unload-settings"));
}
