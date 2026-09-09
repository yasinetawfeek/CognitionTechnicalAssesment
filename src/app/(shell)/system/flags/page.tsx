import { redirect } from "next/navigation";

export default function LegacyFlagsRedirect() {
  redirect("/flags");
}
