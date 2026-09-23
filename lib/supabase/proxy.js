import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Pages that need a signed-in user. Which role may open which page is checked
// again, authoritatively, in each page (lib/auth/session.js).
const PROTECTED_PREFIXES = ["/student", "/mentor", "/admin", "/set-password"];

// Pages that only make sense when signed out.
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

function matches(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Refreshes the Supabase session cookie on every request and does the cheap
 * redirects (signed-out users away from app pages, signed-in users away from
 * the login page). Follows the @supabase/ssr pattern: cookies written by the
 * client must be copied onto whatever response we return.
 */
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() validates the JWT; do not put code between client creation and
  // this call, or sessions can be dropped at random (per Supabase guidance).
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const redirectTo = (path) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!isSignedIn && PROTECTED_PREFIXES.some((prefix) => matches(pathname, prefix))) {
    return redirectTo("/login");
  }
  if (isSignedIn && GUEST_ONLY_PATHS.some((prefix) => matches(pathname, prefix))) {
    return redirectTo("/");
  }
  return response;
}
