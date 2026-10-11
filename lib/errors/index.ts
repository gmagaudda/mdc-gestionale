export type ErrorCode =
  "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE";
export class AppError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };
