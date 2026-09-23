import "server-only";
import nodemailer from "nodemailer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { evaluateEmailQuota, hourlyLimitFromEnv } from "./quota";

// The app sends its own authentication emails over SMTP (e.g. Brevo) instead of
// relying on Supabase Auth's mailer. Supabase only generates the codes and
// links (auth.admin.generateLink, which sends nothing). This keeps email
// working without access to the Supabase project's SMTP settings.

let transporter;

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    throw new Error("EMAIL_NOT_CONFIGURED");
  }
  const port = Number(SMTP_PORT || 587);
  transporter ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 587 upgrades to TLS with STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

/**
 * Throws EMAIL_COOLDOWN / EMAIL_HOURLY_LIMIT when sending now would break the
 * limits in ./quota.js. Call before creating codes or accounts, so nothing is
 * created that cannot be emailed.
 */
export async function assertCanSendEmail(email, kind) {
  const admin = createSupabaseAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [last, lastHour] = await Promise.all([
    admin
      .from("email_events")
      .select("created_at")
      .eq("email", email)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(1),
    admin.from("email_events").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
  ]);
  if (last.error) throw last.error;
  if (lastHour.error) throw lastHour.error;

  const blocked = evaluateEmailQuota({
    lastSentToAddressAt: last.data[0] ? new Date(last.data[0].created_at) : null,
    sentInLastHour: lastHour.count ?? 0,
    hourlyLimit: hourlyLimitFromEnv(),
  });
  if (blocked) throw new Error(blocked);
}

/** Sends one email and records it in public.email_events. */
export async function sendEmail({ to, kind, subject, html, text, attachments }) {
  await getTransporter().sendMail({ from: process.env.EMAIL_FROM, to, subject, html, text, attachments });
  await createSupabaseAdminClient().from("email_events").insert({ email: to, kind });
}
