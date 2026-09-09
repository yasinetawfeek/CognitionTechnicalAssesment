"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActionState } from "@/kernel/actions";
import { Button, cn, Input, type ButtonProps } from "./primitives";

// ---------------------------------------------------------------------------
// ActionForm — wires a kernel `action()` server action to a <form> with error/success display
// ---------------------------------------------------------------------------

const FormStateContext = createContext<ActionState<unknown> | undefined>(undefined);

export function ActionForm<T>({
  action: serverAction,
  children,
  className,
  onSuccess,
  resetOnSuccess,
  ...rest
}: {
  action: (prev: ActionState<T> | undefined, formData: FormData) => Promise<ActionState<T>>;
  children: ReactNode;
  className?: string;
  onSuccess?: (state: ActionState<T> & { ok: true }) => void;
  resetOnSuccess?: boolean;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const [state, formAction] = useActionState(serverAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const lastHandled = useRef<ActionState<T> | undefined>(undefined);

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
      router.refresh();
    }
  }, [state, onSuccess, resetOnSuccess, router]);

  return (
    <FormStateContext.Provider value={state}>
      <form ref={formRef} action={formAction} className={cn("space-y-4", className)} {...rest}>
        {children}
        {state && !state.ok && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && state.message && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{state.message}</p>}
      </form>
    </FormStateContext.Provider>
  );
}

/** Field-level validation issues from the last submission. */
export function useFieldError(name: string): string[] | undefined {
  const state = useContext(FormStateContext);
  if (!state || state.ok) return undefined;
  return state.issues?.[name];
}

export function FieldError({ name }: { name: string }) {
  const errors = useFieldError(name);
  if (!errors?.length) return null;
  return (
    <p className="text-xs text-danger" role="alert">
      {errors.join(", ")}
    </p>
  );
}

/**
 * Submit button for ActionForm. `name`/`value` are forwarded into the FormData via a
 * hidden input set on click, so multiple submit buttons (Approve / Reject) work reliably.
 */
export function SubmitButton({ children, pendingText, name, value, onClick, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  const hidden = useRef<HTMLInputElement>(null);
  return (
    <>
      {name !== undefined && <input ref={hidden} type="hidden" name={name} defaultValue="" disabled />}
      <Button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (name !== undefined && hidden.current) {
            e.currentTarget.form
              ?.querySelectorAll<HTMLInputElement>(`input[type=hidden][name="${name}"]`)
              .forEach((i) => (i.disabled = i !== hidden.current));
            hidden.current.value = String(value ?? "");
          }
          onClick?.(e);
        }}
        {...props}
      >
        {pending ? pendingText ?? "Saving…" : children}
      </Button>
    </>
  );
}

/**
 * Small inline form for one-click actions (toggle, approve, retry).
 */
export function InlineAction<T>({
  action: serverAction,
  children,
  confirm,
  values = {},
  ...button
}: {
  action: (prev: ActionState<T> | undefined, formData: FormData) => Promise<ActionState<T>>;
  children: ReactNode;
  confirm?: string;
  /** Hidden inputs submitted with the action. */
  values?: Record<string, string>;
} & Omit<ButtonProps, "type" | "children">) {
  const [state, formAction] = useActionState(serverAction, undefined);
  const router = useRouter();
  const last = useRef<ActionState<T> | undefined>(undefined);
  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      if (state.ok) router.refresh();
    }
  }, [state, router]);
  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-start gap-1"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton pendingText="…" {...button}>
        {children}
      </SubmitButton>
      {state && !state.ok && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Search box bound to ?q=
// ---------------------------------------------------------------------------

export function SearchBox({ placeholder = "Search…", param = "q" }: { placeholder?: string; param?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get(param) ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (value) next.set(param, value);
      else next.delete(param);
      next.delete("page");
      const qs = next.toString();
      if (qs !== sp.toString()) router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [value, param, router, sp]);
  return <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="max-w-xs" />;
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export function Dialog({
  trigger,
  title,
  description,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = controlledOpen ?? open;
  const setIsOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);
  return (
    <>
      {trigger && <span onClick={() => setIsOpen(true)}>{trigger}</span>}
      <dialog
        ref={ref}
        onClose={() => setIsOpen(false)}
        className="m-auto w-full max-w-lg rounded-lg border border-border bg-surface p-0 shadow-xl backdrop:bg-black/40"
      >
        {isOpen && (
          <div className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            {typeof children === "function" ? children(() => setIsOpen(false)) : children}
          </div>
        )}
      </dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

export function RelativeTime({ date, className }: { date: Date | string; className?: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const [, tick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time
      dateTime={d.toISOString()}
      title={mounted ? d.toLocaleString() : undefined}
      className={cn("tabular-nums", className)}
      suppressHydrationWarning
    >
      {mounted ? formatRelative(d) : d.toISOString().slice(0, 16).replace("T", " ")}
    </time>
  );
}

export function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const s = Math.round(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
