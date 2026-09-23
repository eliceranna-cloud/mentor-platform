import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Email links land here (built in lib/auth/links.js). The token is exchanged for a
// session cookie, then the user continues to the right page.
//   invite   -> /set-password?mode=invite  (mentor / admin activation)
//   recovery -> /set-password              (forgot password)
//   email    -> /                          (link-style sign-up confirmation)

const NEXT_BY_TYPE = {
  invite: "/set-password?mode=invite",
  recovery: "/set-password",
  email: "/",
  signup: "/",
};

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (tokenHash && NEXT_BY_TYPE[type]) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(NEXT_BY_TYPE[type], origin));
  } else if (code) {
    // PKCE links (used if the email templates were left at their defaults and
    // the reset was requested from this same browser).
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/set-password", origin));
  }

  return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
}
