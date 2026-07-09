import { redirect } from "next/navigation";
import { getBangkokTodayDateInput } from "@/lib/date-utils";

export default function ThaiCostDataEntryRedirect() {
  redirect(`/thai-cost/handling?date=${getBangkokTodayDateInput()}`);
}
