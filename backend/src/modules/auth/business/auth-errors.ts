export class AuthError extends Error {
  constructor(readonly status: number, readonly code: "VALIDATION_ERROR" | "IDEMPOTENCY_IN_PROGRESS" | "IDEMPOTENCY_CONFLICT" | "IDEMPOTENCY_EXPIRED" | "NOT_FOUND" | "MEDIA_UNAVAILABLE" | "INVALID_CREDENTIALS" | "UNAUTHENTICATED" | "SESSION_EXPIRED" | "FORBIDDEN" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE", readonly retryAfter?: number) {
    super(code);
  }
}
