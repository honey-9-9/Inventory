import { NextResponse, type NextRequest } from "next/server";

import { createProxyClient } from "@/lib/supabase/proxy";

/**
 * Two jobs, on every request:
 *
 *   1. Refresh the Supabase session cookie so a signed-in user is not logged
 *      out mid-session.
 *   2. Keep signed-out visitors away from the app, and signed-in users away
 *      from the login page.
 *
 * Role-based routing (viewer -> admin URL) is handled by the route group
 * layouts, which can read the user's profile; and neither layer is what
 * actually protects the data - the RLS policies do that.
 */
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { supabase, response } = createProxyClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response();
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals and static assets - those never
     * need a session check and skipping them keeps navigation snappy.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
