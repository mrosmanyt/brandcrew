import { NextResponse } from "next/server";
import { AuthError, ForbiddenError } from "@/lib/auth";
import { BudgetError } from "@/lib/usage";

export class ClientError extends Error {
  status = 400;
  code = "invalid_request";
  constructor(message: string, status = 400, code = "invalid_request") {
    super(message);
    this.name = "ClientError";
    this.status = status;
    this.code = code;
  }
}

export class ApiAuthError extends Error {
  status = 401;
  code = "unauthorized";
  constructor(message = "Invalid API key.") {
    super(message);
    this.name = "ApiAuthError";
  }
}

export class ApiRateLimitError extends Error {
  status = 429;
  code = "rate_limited";
  retryAfterSec = 60;
  constructor(
    message = "API rate limit exceeded. Try again in a minute.",
    retryAfterSec = 60,
  ) {
    super(message);
    this.name = "ApiRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

function statusCodeName(status: number) {
  if (status === 400) return "invalid_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 405) return "method_not_allowed";
  if (status === 429) return "rate_limited";
  return "internal_error";
}

function errorCode(error: unknown, status: number) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return statusCodeName(status);
}

export function jsonFail(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, code: code ?? statusCodeName(status) },
    { status },
  );
}

function publicInternalMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  const looksInternal =
    /DATABASE_URL|DIRECT_URL|prisma|ECONNREFUSED|TURBOPACK|password|secret|postgres:\/\//i.test(
      raw,
    ) || raw.length > 280;
  if (process.env.NODE_ENV === "production" || looksInternal) {
    return "Something went wrong. Try again.";
  }
  return raw;
}

/** Prisma / Postgres connectivity or missing migration — auth bridge should not 500 HTML. */
export function isDatabaseUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return /P1001|P1017|P2021|P2022|ECONNREFUSED|Can't reach database|database server|Connection terminated|relation .* does not exist|table .* does not exist/i.test(
    `${message} ${code}`,
  );
}

/** JSON error for native auth bridge routes — maps DB outages to 503. */
export function jsonAuthBridgeError(error: unknown) {
  if (isDatabaseUnavailableError(error)) {
    return NextResponse.json(
      {
        error: "Auth service is temporarily unavailable. Try again in a moment.",
        code: "service_unavailable",
      },
      { status: 503 },
    );
  }
  return jsonError(error);
}

export function jsonError(error: unknown) {
  if (
    error instanceof AuthError ||
    error instanceof ForbiddenError ||
    error instanceof ClientError ||
    error instanceof ApiAuthError ||
    error instanceof ApiRateLimitError ||
    error instanceof BudgetError
  ) {
    const headers: Record<string, string> = {};
    if (error instanceof ApiAuthError) {
      headers["WWW-Authenticate"] = "Bearer";
    }
    if (error instanceof ApiRateLimitError) {
      headers["Retry-After"] = String(error.retryAfterSec || 60);
    }
    return NextResponse.json(
      { error: error.message, code: errorCode(error, error.status) },
      { status: error.status, headers },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: publicInternalMessage(error), code: "internal_error" },
    { status: 500 },
  );
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
