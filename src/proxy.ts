import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import {
  CONSOLE_PATH,
  consoleLoginNext,
  isConsoleHostname,
} from "@/lib/console-site";
import { safeNextPath } from "@/lib/google-auth-shared";
import { applySecurityHeaders, requestLooksHttps } from "@/lib/security-headers";

function withSecurity(response: NextResponse, request: NextRequest) {
  applySecurityHeaders(response.headers, {
    https: requestLooksHttps({
      protoHeader: request.headers.get("x-forwarded-proto"),
      protocol: request.nextUrl.protocol,
    }),
  });
  return response;
}

function needsAuth(pathname: string, consoleHost: boolean) {
  if (
    pathname.startsWith("/desk") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith(CONSOLE_PATH)
  ) {
    return true;
  }
  return consoleHost && (pathname === "/" || pathname === "");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = Boolean(session);
  const host = request.headers.get("host");
  const consoleHost = isConsoleHostname(host);

  if (consoleHost && (pathname === "/" || pathname === "")) {
    const url = request.nextUrl.clone();
    url.pathname = CONSOLE_PATH;
    if (!authed) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", consoleLoginNext(CONSOLE_PATH));
      return withSecurity(NextResponse.redirect(login), request);
    }
    return withSecurity(NextResponse.rewrite(url), request);
  }

  if (needsAuth(pathname, consoleHost) && !authed) {
    const login = new URL("/login", request.url);
    const next = consoleHost
      ? consoleLoginNext(`${pathname}${request.nextUrl.search || ""}`)
      : `${pathname}${request.nextUrl.search || ""}`;
    login.searchParams.set("next", next);
    return withSecurity(NextResponse.redirect(login), request);
  }

  if ((pathname === "/login" || pathname === "/signup") && authed) {
    const next = request.nextUrl.searchParams.get("next");
    const fallback = consoleHost ? CONSOLE_PATH : "/desk";
    return withSecurity(
      NextResponse.redirect(new URL(safeNextPath(next, fallback), request.url)),
      request,
    );
  }

  return withSecurity(NextResponse.next(), request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
