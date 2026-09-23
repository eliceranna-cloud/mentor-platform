import { redirect } from "next/navigation";
import { signedInFromEmailLink } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata = { title: "비밀번호 설정" };

const MODES = ["invite", "reset"];

/**
 * Reached from an invitation (mode=invite) or password-reset email, via
 * /auth/confirm which has already signed the user in. Changing a password is
 * always done through "비밀번호 찾기" (forgot password); there is no separate
 * change-password screen, and this page refuses sessions that did not come
 * from an email link in the last 15 minutes.
 */
export default async function SetPasswordPage({ searchParams }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { mode } = await searchParams;
  const safeMode = MODES.includes(mode) ? mode : "reset";
  if (!user || !(await signedInFromEmailLink(supabase))) redirect("/login?error=link_invalid");

  return <SetPasswordForm email={user.email} mode={safeMode} />;
}
