import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { isKernelError, ValidationError } from "./errors";

/**
 * Result shape returned by kernel-style server actions, consumed by `<ActionForm>` / `useActionState`.
 */
export type ActionState<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; issues?: Record<string, string[]> };

export const idle: ActionState<never> = { ok: true };

/**
 * Wrap a server action body so kernel errors become form-friendly results instead of crashing
 * the page. Next.js redirects thrown inside `fn` are re-thrown untouched.
 *
 *   export const createThing = action(async (form) => { ... return { ok: true, message: "Saved" } });
 */
export function action<T>(
  fn: (formData: FormData) => Promise<ActionState<T>>,
): (prev: ActionState<T> | undefined, formData: FormData) => Promise<ActionState<T>> {
  return async (_prev, formData) => {
    try {
      return await fn(formData);
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return toActionError(err);
    }
  };
}

export function toActionError(err: unknown): ActionState<never> {
  if (err instanceof ValidationError) return { ok: false, error: err.message, issues: err.issues };
  if (isKernelError(err)) return { ok: false, error: err.message };
  console.error("[action] unexpected error", err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** Parse FormData against a zod schema, throwing a kernel ValidationError with per-field issues. */
export function parseForm<S extends z.ZodTypeAny>(schema: S, formData: FormData): z.infer<S> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const k = key.endsWith("[]") ? key.slice(0, -2) : key;
    const repeated = key.endsWith("[]") || formData.getAll(key).length > 1;
    if (repeated) {
      const list = (raw[k] as unknown[] | undefined) ?? [];
      list.push(value);
      raw[k] = list;
    } else {
      raw[k] = value;
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "_";
      (issues[path] ??= []).push(issue.message);
    }
    throw new ValidationError(issues);
  }
  return result.data;
}

/** Common zod coercions for form fields. */
export const formField = {
  checkbox: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  optionalString: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  number: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number()),
  list: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string())),
};
