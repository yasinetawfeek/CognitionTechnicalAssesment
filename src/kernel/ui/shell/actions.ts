"use server";

import { redirect } from "next/navigation";
import { getContext } from "@/kernel/context";
import { signOut } from "@/kernel/auth";

export async function logoutAction() {
  const ctx = await getContext();
  if (ctx) await signOut({ id: ctx.user.id, email: ctx.user.email });
  redirect("/login");
}
