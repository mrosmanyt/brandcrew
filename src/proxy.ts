import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = Boolean(session);

  if (
    (pathname.startsWith("/desk") || pathname.startsWith("/onboarding")) &&
    !authed
  ) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if ((pathname === "/login" || pathname === "/signup") && authed) {
    return NextResponse.redirect(new URL("/desk", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/desk/:path*", "/onboarding", "/login", "/signup"],
};
