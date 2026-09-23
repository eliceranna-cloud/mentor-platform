import { describe, expect, it } from "vitest";
import {
  formatPhone,
  isValidEmail,
  isValidHttpUrl,
  isValidPhone,
  normalizeEmail,
  passwordError,
  signupErrors,
  validatePassword,
} from "@/lib/validation";
import { authErrorMessage, errorCode, toUserMessage } from "@/lib/errors";

describe("email", () => {
  it("normalises case and whitespace, the same way the database compares", () => {
    expect(normalizeEmail("  Foo.Bar@Naver.COM ")).toBe("foo.bar@naver.com");
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});

describe("password", () => {
  it("requires 8+ characters with letters and digits", () => {
    expect(validatePassword("abcdefgh")).not.toBeNull();
    expect(validatePassword("12345678")).not.toBeNull();
    expect(validatePassword("abc1234")).not.toBeNull();
    expect(validatePassword("abcd1234")).toBeNull();
  });

  it("checks the confirmation when given", () => {
    expect(validatePassword("abcd1234", "abcd1235")).toBe("비밀번호가 서로 달라요.");
    expect(validatePassword("abcd1234", "abcd1234")).toBeNull();
  });
});

describe("sign-up form", () => {
  const valid = { email: "a@b.co", phone: "010-1234-5678", password: "abcd1234", passwordConfirm: "abcd1234", consent: true };

  it("is valid only when every required field is filled correctly and consent is given", () => {
    expect(signupErrors(valid)).toEqual({});
    expect(Object.keys(signupErrors({ email: "", phone: "", password: "", passwordConfirm: "", consent: false }))).toEqual([
      "email",
      "phone",
      "password",
      "passwordConfirm",
      "consent",
    ]);
  });

  it("explains exactly which password rule is missing", () => {
    expect(passwordError("abc1")).toContain("8자 이상");
    expect(passwordError("12345678")).toContain("영문");
    expect(passwordError("abcdefgh")).toContain("숫자");
    expect(signupErrors({ ...valid, passwordConfirm: "abcd1235" }).passwordConfirm).toBe("비밀번호가 서로 달라요.");
  });

  it("requires consent", () => {
    expect(signupErrors({ ...valid, consent: false })).toHaveProperty("consent");
  });
});

describe("phone", () => {
  it("accepts Korean mobile numbers in any spacing", () => {
    expect(isValidPhone("010-1234-5678")).toBe(true);
    expect(isValidPhone("010 1234 5678")).toBe(true);
    expect(isValidPhone("02-123-4567")).toBe(false);
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
    expect(formatPhone("0111234567")).toBe("011-123-4567");
  });
});

describe("urls", () => {
  it("accepts only http(s) links", () => {
    expect(isValidHttpUrl("https://26ictoc.elice.io/courses/1/join")).toBe(true);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});

describe("error messages", () => {
  it("maps database codes raised by the booking functions", () => {
    expect(errorCode({ message: "SLOT_TAKEN" })).toBe("SLOT_TAKEN");
    expect(toUserMessage({ message: "RULE_CONSECUTIVE" })).toContain("이어지는 시간");
  });

  it("falls back to a generic sentence for unknown errors", () => {
    expect(toUserMessage({ message: "something odd" })).toContain("잠시 후");
    expect(toUserMessage({ message: "Failed to fetch" })).toContain("인터넷");
  });

  it("maps auth errors", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toContain("비밀번호가 맞지");
    expect(authErrorMessage({ message: "Database error saving new user" })).toContain("명단");
  });
});
