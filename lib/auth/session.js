import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Where each role lands after signing in. */
export const ROLE_HOME = { student: "/student", mentor: "/mentor", admin: "/admin" };

/**
 * The signed-in user and their app role ('student' | 'mentor' | 'admin' | null).
 * The role comes from public.app_role(), i.e. which table the account is
 * linked to, so it cannot be spoofed from the browser.
 */
export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: role, error } = await supabase.rpc("app_role");
  if (error) throw error;
  return { supabase, user, role };
}

/**
 * Page guard: sends signed-out users to /login and users with another role
 * to their own home. Returns the session for the page to use.
 */
export async function requireRole(role) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== role) redirect(session.role ? ROLE_HOME[session.role] : "/");
  return session;
}

/** How long after opening an email link the user may still set a password. */
export const PASSWORD_LINK_WINDOW_SECONDS = 15 * 60;

/**
 * True when the current session was started from an email link or code
 * (invitation / password reset) within the last 15 minutes. Setting a
 * password requires this, so a device left signed in cannot be used to change
 * someone's password: every change goes through "비밀번호 찾기" and the inbox.
 * Supabase records the sign-in method in the signed access token (`amr`), so
 * it cannot be faked from the browser.
 */
export async function signedInFromEmailLink(supabase) {
  const { data } = await supabase.auth.getClaims();
  const latest = [...(data?.claims?.amr ?? [])].sort((a, b) => b.timestamp - a.timestamp)[0];
  if (!latest || !["otp", "recovery", "invite", "magiclink"].includes(latest.method)) return false;
  return Date.now() / 1000 - latest.timestamp <= PASSWORD_LINK_WINDOW_SECONDS;
}
