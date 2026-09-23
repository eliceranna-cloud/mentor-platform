// Input rules shared by forms (client) and server actions. The server always
// re-validates; client checks only save a round trip.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export const PASSWORD_RULE_TEXT = "영문과 숫자를 섞어 8자 이상";

/**
 * Each password rule with the message shown when it is not met. Forms show the
 * labels as a live checklist; the first unmet rule becomes the field error.
 */
export const PASSWORD_RULES = [
  { label: "8자 이상", test: (pw) => pw.length >= 8, message: "비밀번호는 8자 이상이어야 해요." },
  { label: "영문 포함", test: (pw) => /[a-zA-Z]/.test(pw), message: "비밀번호에 영문을 1자 이상 넣어주세요." },
  { label: "숫자 포함", test: (pw) => /\d/.test(pw), message: "비밀번호에 숫자를 1자 이상 넣어주세요." },
];

/** Error for the password field alone, or null. */
export function passwordError(password) {
  const pw = String(password ?? "");
  if (!pw) return "비밀번호를 입력해주세요.";
  return PASSWORD_RULES.find((rule) => !rule.test(pw))?.message ?? null;
}

/** Error for the confirmation field, or null. */
export function passwordConfirmError(password, confirmation) {
  if (!confirmation) return "비밀번호를 한 번 더 입력해주세요.";
  return password === confirmation ? null : "비밀번호가 서로 달라요.";
}

/** Returns an error message, or null when the password (and confirmation, if given) is acceptable. */
export function validatePassword(password, confirmation) {
  return passwordError(password) ?? (confirmation === undefined ? null : passwordConfirmError(password, confirmation));
}

/** Error for the email field, or null. */
export function emailError(email) {
  if (!String(email ?? "").trim()) return "이메일을 입력해주세요.";
  return isValidEmail(email) ? null : "이메일 형식을 확인해주세요. 예: name@example.com";
}

/** Error for the mobile number field, or null. */
export function phoneError(phone) {
  if (!phoneDigits(phone)) return "휴대전화 번호를 입력해주세요.";
  return isValidPhone(phone) ? null : "휴대전화 번호를 확인해주세요. 예: 010-1234-5678";
}

/**
 * Per-field errors for the student sign-up form (format checks only; whether
 * the email is on the roster is checked by the server). Empty object = valid.
 */
export function signupErrors({ email, phone, password, passwordConfirm, consent }) {
  const errors = {
    email: emailError(email),
    phone: phoneError(phone),
    password: passwordError(password),
    passwordConfirm: passwordConfirmError(password, passwordConfirm),
    consent: consent ? null : "개인정보 수집·이용에 동의해야 가입할 수 있어요.",
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

export function phoneDigits(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

/** Korean mobile numbers: 010-1234-5678 (11 digits) or older 10-digit 01x numbers. */
export function isValidPhone(phone) {
  return /^01[0-9]{8,9}$/.test(phoneDigits(phone));
}

/** "01012345678" -> "010-1234-5678". Same output as public.format_phone(). */
export function formatPhone(phone) {
  const d = phoneDigits(phone);
  if (/^01[0-9]{9}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (/^01[0-9]{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

export function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
