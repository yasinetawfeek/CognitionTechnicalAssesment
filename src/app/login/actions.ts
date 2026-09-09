"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { action, parseForm } from "@/kernel/actions";
import { signInWithPassword } from "@/kernel/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export const loginAction = action(async (formData) => {
  const { email, password, next } = parseForm(schema, formData);
  const result = await signInWithPassword(email, password, next);
  redirect(result.next);
});
