export class KernelError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 500, code = "KERNEL_ERROR") {
    super(message);
    this.name = "KernelError";
    this.status = status;
    this.code = code;
  }
}

export class UnauthorizedError extends KernelError {
  constructor(message = "You must be signed in") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends KernelError {
  readonly permission?: string;
  constructor(permission?: string, message?: string) {
    super(message ?? (permission ? `Missing permission: ${permission}` : "Forbidden"), 403, "FORBIDDEN");
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}

export class NotFoundError extends KernelError {
  constructor(what = "Resource") {
    super(`${what} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends KernelError {
  readonly issues: Record<string, string[]>;
  constructor(issues: Record<string, string[]>, message?: string) {
    const summary = Object.entries(issues)
      .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
      .join("; ");
    super(message ?? (summary ? `Validation failed — ${summary}` : "Validation failed"), 400, "VALIDATION");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export function isKernelError(e: unknown): e is KernelError {
  return e instanceof KernelError;
}
