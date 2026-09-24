import { describe, expect, it } from "vitest";
import { DEFAULT_HOURLY_LIMIT, evaluateEmailQuota, hourlyLimitFromEnv } from "@/lib/email/quota";
import { invitationEmail, passwordResetEmail, signupCodeEmail } from "@/lib/email/templates";

const NOW = new Date("2026-10-12T10:00:00Z");
const secondsAgo = (s) => new Date(NOW.getTime() - s * 1000);

describe("evaluateEmailQuota", () => {
  it("allows the first email to an address", () => {
    expect(evaluateEmailQuota({ lastSentToAddressAt: null, sentInLastHour: 0, hourlyLimit: 50, now: NOW })).toBeNull();
  });

  it("blocks a repeat to the same address within a minute", () => {
    expect(evaluateEmailQuota({ lastSentToAddressAt: secondsAgo(30), sentInLastHour: 1, hourlyLimit: 50, now: NOW })).toBe(
      "EMAIL_COOLDOWN"
    );
    expect(evaluateEmailQuota({ lastSentToAddressAt: secondsAgo(61), sentInLastHour: 1, hourlyLimit: 50, now: NOW })).toBeNull();
  });

  it("blocks everyone once the hourly cap is reached", () => {
    expect(evaluateEmailQuota({ lastSentToAddressAt: null, sentInLastHour: 50, hourlyLimit: 50, now: NOW })).toBe(
      "EMAIL_HOURLY_LIMIT"
    );
  });

  it("reads the hourly cap from the environment with a safe default", () => {
    expect(hourlyLimitFromEnv("120")).toBe(120);
    expect(hourlyLimitFromEnv(undefined)).toBe(DEFAULT_HOURLY_LIMIT);
    expect(hourlyLimitFromEnv("abc")).toBe(DEFAULT_HOURLY_LIMIT);
  });
});

describe("email templates", () => {
  it("puts the sign-up code in both HTML and plain text", () => {
    const mail = signupCodeEmail("482913", "https://x.test/signup/verify");
    expect(mail.subject).toContain("인증 코드");
    expect(mail.html).toContain("482913");
    expect(mail.text).toContain("482913");
  });

  it("puts the code in the subject and embeds the logo instead of linking to it", () => {
    const mail = signupCodeEmail("20169236", "https://x.test/signup/verify");
    expect(mail.html).toContain('href="https://x.test/signup/verify"');
    expect(mail.subject).toContain("20169236");
    expect(mail.html).toContain('src="cid:elice-logo"');
    expect(mail.attachments[0]).toMatchObject({ cid: "elice-logo", encoding: "base64" });
    expect(passwordResetEmail("https://x.test/r").attachments[0].cid).toBe("elice-logo");
  });

  it("escapes links so a crafted URL cannot break out of the href", () => {
    const mail = invitationEmail('https://x.test/auth/confirm?token_hash=a"><script>&type=invite');
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&quot;&gt;&lt;script&gt;");
    expect(passwordResetEmail("https://x.test/r").text).toContain("https://x.test/r");
  });
});
