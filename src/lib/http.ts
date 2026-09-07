import { NextResponse } from "next/server";
import { ApiAuthError, ApiRateLimitError } from "@/lib/api-keys";
import { AuthError, ForbiddenError } from "@/lib/auth";

export class ClientError extends Error {
  status = 400;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ClientError";
    this.status = status;
  }
}

export function jsonError(error: unknown) {
  if (
    error instanceof AuthError ||
    error instanceof ForbiddenError ||
    error instanceof ClientError ||
    error instanceof ApiAuthError ||
    error instanceof ApiRateLimitError
  ) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
