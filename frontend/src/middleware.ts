import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side auth middleware.
 * Checks for orch_token cookie/localStorage on protected routes.
 * The actual token is stored client-side in localStorage — this middleware
 * checks for the presence of the auth cookie set by the login page.
 */

const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico", "/redesign"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for auth cookie (set by login page alongside localStorage token)
  const token = request.cookies.get("orch_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login).*)"],
};
