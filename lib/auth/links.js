import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

// Wrappers around Supabase's auth.admin.generateLink. It creates the one-time
// code or token and returns it WITHOUT sending an email; lib/email sends it.
// Links point to /auth/confirm, which exchanges the token for a session.

const alreadyRegistered = (error) =>
  error?.code === "email_exists" || /already (been )?registered|already exists/i.test(error?.message ?? "");

async function confirmUrl(hashedToken, type) {
  return `${await getSiteUrl()}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${type}`;
}

/**
 * New student: creates the (unconfirmed) account and returns the one-time code (its length is a Supabase setting, currently 8).
 * The auth.users trigger checks the roster and links the students row.
 * If the account already exists unconfirmed, a fresh code is issued instead.
 */
export async function createSignupCode({ email, password, phone }) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { data: { phone } },
  });
  if (error) throw error;
  return data.properties.email_otp;
}

/**
 * Fresh code for an existing account that has not confirmed its email yet
 * ("코드 다시 받기"). Verified on the sign-up page with type "email".
 */
export async function createResendCode(email) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return data.properties.email_otp;
}

/**
 * Invitation for a mentor or admin. Creates the account on first use. If the
 * account already exists (invited before, or active), returns a password-reset
 * link instead: the person lands on "set password" either way.
 * @returns {Promise<{ link: string, kind: "invite" | "reset" }>}
 */
export async function createInvitationLink(email, name) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { name } } });
  if (!error) return { link: await confirmUrl(data.properties.hashed_token, "invite"), kind: "invite" };
  if (!alreadyRegistered(error)) throw error;

  const reset = await createRecoveryLink(email);
  if (!reset) throw error;
  return { link: reset, kind: "reset" };
}

/** Password-reset link, or null when no account uses this email. */
export async function createRecoveryLink(email) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) {
    if (error.status === 404 || /not found/i.test(error.message ?? "")) return null;
    throw error;
  }
  return await confirmUrl(data.properties.hashed_token, "recovery");
}
