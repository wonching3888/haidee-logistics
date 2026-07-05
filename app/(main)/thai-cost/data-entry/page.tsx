import { Suspense } from "react";
import { redirect } from "next/navigation";

export default function ThaiCostDataEntryRedirect() {
  redirect("/thai-cost/attendance");
}
