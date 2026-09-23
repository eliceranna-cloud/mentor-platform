// Sending limits, applied before every email. Pure so it can be unit-tested.
//
// - Per address: one email of the same kind per COOLDOWN_SECONDS, so a "resend"
//   button cannot be used to flood someone's inbox.
// - Overall: at most `hourlyLimit` emails per rolling hour (EMAIL_HOURLY_LIMIT,
//   default 50), which keeps the app inside the SMTP provider's free tier.

export const COOLDOWN_SECONDS = 60;
export const DEFAULT_HOURLY_LIMIT = 50;

/**
 * @param {{ lastSentToAddressAt: Date | null, sentInLastHour: number, hourlyLimit: number, now?: Date }} input
 * @returns {null | "EMAIL_COOLDOWN" | "EMAIL_HOURLY_LIMIT"} null when sending is allowed
 */
export function evaluateEmailQuota({ lastSentToAddressAt, sentInLastHour, hourlyLimit, now = new Date() }) {
  if (lastSentToAddressAt && now - lastSentToAddressAt < COOLDOWN_SECONDS * 1000) return "EMAIL_COOLDOWN";
  if (sentInLastHour >= hourlyLimit) return "EMAIL_HOURLY_LIMIT";
  return null;
}

export function hourlyLimitFromEnv(value = process.env.EMAIL_HOURLY_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HOURLY_LIMIT;
}
