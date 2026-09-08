import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { safeNextPath } from "@/lib/google-auth-shared";
import { applySecurityHeaders } from "@/lib/security-headers";

function withSecurity(response: NextResponse) {
  applySecurityHeaders(response.headers);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = Boolean(session);

  if (
    (pathname.startsWith("/desk") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/admin")) &&
    !authed
  ) {
    const login = new URL("/login", request.url);
    const next = `${pathname}${request.nextUrl.search || ""}`;
    login.searchParams.set("next", next);
    return withSecurity(NextResponse.redirect(login));
  }

  if ((pathname === "/login" || pathname === "/signup") && authed) {
    const next = request.nextUrl.searchParams.get("next");
    return withSecurity(
      NextResponse.redirect(new URL(safeNextPath(next, "/desk"), request.url)),
    );
  }

  return withSecurity(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
