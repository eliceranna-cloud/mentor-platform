"use server";

import { redirect } from "next/navigation";
import { createRecoveryLink, createResendCode, createSignupCode } from "@/lib/auth/links";
import { ROLE_HOME, signedInFromEmailLink } from "@/lib/auth/session";
import { assertCanSendEmail, sendEmail } from "@/lib/email/send";
import { passwordResetEmail, signupCodeEmail } from "@/lib/email/templates";
import { authErrorMessage } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatPhone,
  isValidEmail,
  normalizeEmail,
  passwordConfirmError,
  passwordError,
  signupErrors,
} from "@/lib/validation";

// Every action returns { ok: true, ... } or { ok: false, error } so forms can
// show the message inline. Inputs are re-validated here; never trust the form.
// Passwords are passed straight to Supabase Auth, which stores only a bcrypt
// hash; the app never stores or logs them.

const NOT_ON_ROSTER =
  "LXP(엘리스 학습 사이트)에 등록된 이메일과 일치하지 않아요. LXP 가입 이메일을 확인하고, 계속 안 되면 운영 사무국(관리자)에 문의해주세요.";
const ALREADY_REGISTERED = "이미 가입된 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해주세요.";

/** `field` names the form field the message belongs to, so it can be shown under it. */
const fail = (error, field) => ({ ok: false, error, ...(field && { field }) });

/** Runs an action body; unexpected errors become a readable message instead of a crash. */
async function attempt(body) {
  try {
    return await body();
  } catch (error) {
    console.error(error);
    return fail(authErrorMessage(error));
  }
}

async function homeFor(supabase) {
  const { data: role } = await supabase.rpc("app_role");
  return role ? ROLE_HOME[role] : "/";
}

async function emailSignupCode(email, code) {
  await sendEmail({ to: email, kind: "signup_code", ...signupCodeEmail(code) });
}

/**
 * Student sign-up, step 1: check the roster, create the (unconfirmed) account
 * and email a one-time code. The code is typed on the next screen.
 */
export async function signUpStudent(input) {
  const email = normalizeEmail(input.email);
  const [field, message] = Object.entries(signupErrors({ ...input, email }))[0] ?? [];
  if (field) return fail(message, field);

  return attempt(() => createStudentAccount(email, formatPhone(input.phone), input.password));
}

/**
 * Checked while the student types, so a wrong email is flagged under the
 * field before they fill in the rest. Returns { ok, status } where status is
 * "available", "not_on_roster" or "registered".
 */
export async function checkSignupEmail({ email }) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return fail("이메일 형식을 확인해주세요.", "email");

  return attempt(async () => {
    const admin = createSupabaseAdminClient();
    const status = await rosterStatus(admin, normalized);
    return { ok: true, status, message: STATUS_MESSAGE[status] ?? null };
  });
}

const STATUS_MESSAGE = { not_on_roster: NOT_ON_ROSTER, registered: ALREADY_REGISTERED };

async function rosterStatus(admin, email) {
  const { data: roster, error } = await admin.from("whitelist_students").select("email").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!roster) return "not_on_roster";
  const confirmedUser = await findConfirmedStudent(admin, email);
  return confirmedUser ? "registered" : "available";
}

/** The student's auth user if they finished sign-up (entered the code), else null. */
async function findConfirmedStudent(admin, email) {
  const { data: student } = await admin.from("students").select("user_id").eq("email", email).maybeSingle();
  if (!student?.user_id) return null;
  const { data } = await admin.auth.admin.getUserById(student.user_id);
  return data?.user?.email_confirmed_at ? data.user : null;
}

async function createStudentAccount(email, phone, password) {
  const admin = createSupabaseAdminClient();

  const { data: roster, error: rosterError } = await admin
    .from("whitelist_students")
    .select("name, region_group, region")
    .eq("email", email)
    .maybeSingle();
  if (rosterError) return fail(authErrorMessage(rosterError));
  if (!roster) return fail(NOT_ON_ROSTER, "email");
  // Only the email decides who may sign up. A phone that differs from the LXP
  // roster or is used by another account is accepted and flagged to admins
  // (public.admin_student_roster: phone_differs / phone_shared).

  // Checked before anything is created, so no account exists that cannot be emailed.
  await assertCanSendEmail(email, "signup_code");

  // Started sign-up before but never entered the code: take the new details
  // and send a fresh code instead of failing, so the student is not stuck.
  const { data: existing } = await admin.from("students").select("id, user_id").eq("email", email).maybeSingle();
  if (existing?.user_id) {
    const { data: userData } = await admin.auth.admin.getUserById(existing.user_id);
    if (userData?.user?.email_confirmed_at) return fail(ALREADY_REGISTERED, "email");

    await admin.auth.admin.updateUserById(existing.user_id, { password, user_metadata: { phone } });
    await admin.from("students").update({ phone }).eq("id", existing.id);
    await emailSignupCode(email, await createResendCode(email));
    return { ok: true, email, name: roster.name };
  }

  await emailSignupCode(email, await createSignupCode({ email, password, phone }));
  return { ok: true, email, name: roster.name };
}

/** Student sign-up, step 2: the code from the email. Signs the student in. */
export async function verifySignupCode({ email, code }) {
  const token = String(code ?? "").replace(/\D/g, "");
  if (token.length < 6) return fail("메일로 받은 인증 코드를 입력해주세요.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token, type: "email" });
  if (error) return fail(authErrorMessage(error));
  return { ok: true, redirectTo: await homeFor(supabase) };
}

/** "코드 다시 받기": only for accounts that exist and are not confirmed yet. */
export async function resendSignupCode({ email }) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return fail("이메일 형식을 확인해주세요.");

  return attempt(async () => {
    const admin = createSupabaseAdminClient();
    const { data: student } = await admin.from("students").select("user_id").eq("email", normalized).maybeSingle();
    if (!student?.user_id) return fail("가입 정보를 찾을 수 없어요. '정보 다시 입력하기'로 처음부터 진행해주세요.");

    const { data: userData } = await admin.auth.admin.getUserById(student.user_id);
    if (userData?.user?.email_confirmed_at) return fail("이미 인증이 끝난 이메일이에요. 로그인해주세요.");

    await assertCanSendEmail(normalized, "signup_code");
    await emailSignupCode(normalized, await createResendCode(normalized));
    return { ok: true };
  });
}

/** One login for everyone. The role decides where the user lands. */
export async function signIn({ email, password }) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized) || !password) return fail("이메일과 비밀번호를 입력해주세요.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error) {
    const needsVerification = error.code === "email_not_confirmed";
    return { ok: false, error: authErrorMessage(error), needsVerification };
  }
  return { ok: true, redirectTo: await homeFor(supabase) };
}

/**
 * Forgot password. Always reports success so the form cannot be used to find
 * out which emails have accounts. Also works for invited mentors and admins
 * who lost their invitation email.
 */
export async function requestPasswordReset({ email }) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return fail("이메일 형식을 확인해주세요.");

  return attempt(async () => {
    await assertCanSendEmail(normalized, "password_reset");
    const link = await createRecoveryLink(normalized);
    if (link) await sendEmail({ to: normalized, kind: "password_reset", ...passwordResetEmail(link) });
    return { ok: true };
  });
}

/** Sets a password after an invitation or reset link (the link already signed the user in). */
export async function updatePassword({ password, passwordConfirm }) {
  const newError = passwordError(password);
  if (newError) return fail(newError, "password");
  const confirmError = passwordConfirmError(password, passwordConfirm);
  if (confirmError) return fail(confirmError, "passwordConfirm");

  const supabase = await createSupabaseServerClient();
  if (!(await signedInFromEmailLink(supabase))) {
    return fail("비밀번호 설정 시간이 지났어요. 비밀번호 찾기로 새 링크를 받아주세요.");
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(authErrorMessage(error), error.code === "same_password" ? "password" : undefined);

  // Moves invited mentors/admins from "초대됨" to "활성" in the admin screens.
  await supabase.rpc("mark_activated");
  return { ok: true, redirectTo: await homeFor(supabase) };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
