"use server";

import { createInvitationLink } from "@/lib/auth/links";
import { getSession } from "@/lib/auth/session";
import { assertCanSendEmail, sendEmail } from "@/lib/email/send";
import { invitationEmail } from "@/lib/email/templates";
import { authErrorMessage } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

// Invitations need the Auth admin API (service-role key), so they run here on
// the server, and only after confirming the caller is an admin.

const fail = (error) => ({ ok: false, error });

async function requireAdminSession() {
  const session = await getSession();
  if (session?.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

/**
 * Emails an invitation link. If the account already exists (invited earlier,
 * or already active), the link is a password-reset link instead: same outcome,
 * the person lands on "set password".
 */
async function sendInvitation(email, name) {
  try {
    await assertCanSendEmail(email, "invite");
    const { link, kind } = await createInvitationLink(email, name);
    await sendEmail({ to: email, kind: "invite", ...invitationEmail(link) });
    return { ok: true, kind };
  } catch (error) {
    console.error(error);
    return fail(authErrorMessage(error));
  }
}

/** Mentors tab: "초대 메일 보내기" / "초대 재발송". */
export async function sendMentorInvite({ mentorId }) {
  const { supabase } = await requireAdminSession();
  const { data: mentor, error } = await supabase.from("mentors").select("id, name, email").eq("id", mentorId).single();
  if (error) return fail(authErrorMessage(error));
  if (!mentor.email) return fail("먼저 멘토의 이메일을 등록해주세요.");

  const result = await sendInvitation(mentor.email, mentor.name);
  if (!result.ok) return result;

  await supabase.from("mentors").update({ invited_at: new Date().toISOString() }).eq("id", mentor.id);
  return result;
}

/** Members tab: add a new admin and email them an invitation. */
export async function inviteAdmin({ name, email }) {
  await requireAdminSession();
  const normalized = normalizeEmail(email);
  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) return fail("이름을 입력해주세요.");
  if (!isValidEmail(normalized)) return fail("이메일 형식을 확인해주세요.");

  // The admins table has no insert policy for signed-in users; rows are only
  // created here, after the admin check above.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("admins").insert({ email: normalized, name: trimmedName });
  if (error?.code === "23505") return fail("이미 등록된 이메일이에요.");
  if (error) return fail(authErrorMessage(error));

  const result = await sendInvitation(normalized, trimmedName);
  if (!result.ok) return result;

  await admin.from("admins").update({ invited_at: new Date().toISOString() }).eq("email", normalized);
  return result;
}

/** Members tab: resend for someone who has not set a password yet. */
export async function resendAdminInvite({ email }) {
  await requireAdminSession();
  const normalized = normalizeEmail(email);
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("admins").select("name").eq("email", normalized).maybeSingle();
  if (!row) return fail("관리자 정보를 찾을 수 없어요.");

  const result = await sendInvitation(normalized, row.name);
  if (!result.ok) return result;

  await admin.from("admins").update({ invited_at: new Date().toISOString() }).eq("email", normalized);
  return result;
}
