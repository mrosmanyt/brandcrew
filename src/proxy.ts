import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { safeNextPath } from "@/lib/google-auth-shared";

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
    return NextResponse.redirect(login);
  }

  if ((pathname === "/login" || pathname === "/signup") && authed) {
    const next = request.nextUrl.searchParams.get("next");
    return NextResponse.redirect(new URL(safeNextPath(next, "/desk"), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/desk/:path*", "/onboarding", "/login", "/signup", "/admin", "/admin/:path*"],
};
