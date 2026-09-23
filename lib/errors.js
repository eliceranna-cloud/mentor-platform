// Turns database and auth errors into sentences a student can act on.
// Booking functions raise short codes (e.g. SLOT_TAKEN); see the migration.

const MESSAGES = {
  // booking
  SLOT_TAKEN: "방금 다른 학생이 먼저 예약한 시간이 있어요. 시간표를 새로 불러왔으니 다시 골라주세요.",
  RULE_SAME_TIME: "같은 시간에 이미 다른 멘토를 예약했어요.",
  RULE_DAILY_LIMIT: "하루에 최대 2개(1시간)까지 예약할 수 있어요.",
  RULE_CONSECUTIVE: "같은 날 2개를 예약하려면 바로 이어지는 시간이어야 해요.",
  SLOT_IN_PAST: "이미 시작했거나 지난 시간은 예약하거나 바꿀 수 없어요.",
  OUTSIDE_PERIOD: "멘토링 기간이 아닌 날짜예요.",
  OUTSIDE_REGION: "내 권역 멘토만 예약할 수 있어요.",
  INVALID_TIME: "예약할 수 없는 시간이에요.",
  MENTOR_NOT_FOUND: "멘토 정보를 찾을 수 없어요. 새로고침 후 다시 시도해주세요.",
  BOOKING_NOT_FOUND: "예약을 찾을 수 없어요. 이미 취소됐을 수 있어요.",
  STUDENT_NOT_FOUND: "학생 정보를 찾을 수 없어요.",
  NOT_A_STUDENT: "학생 계정으로 로그인해야 예약할 수 있어요.",
  NO_SLOTS: "예약할 시간을 먼저 골라주세요.",
  TOO_MANY_SLOTS: "한 번에 너무 많은 시간을 골랐어요. 나눠서 예약해주세요.",
  // admin
  FORBIDDEN: "이 작업을 할 권한이 없어요.",
  ADMIN_NOT_FOUND: "관리자 정보를 찾을 수 없어요.",
  CANNOT_REVOKE_OWNER: "소유자의 권한은 해제할 수 없어요.",
  CANNOT_REVOKE_SELF: "내 권한은 스스로 해제할 수 없어요.",
  // sign-up gate (public.guard_new_user)
  SIGNUP_NOT_ALLOWED: "등록된 명단에 없는 이메일이에요. 관리자에게 문의해주세요.",
  // session log (public.log_session)
  SESSION_NOT_STARTED: "세션이 시작된 뒤에 기록할 수 있어요.",
  INVALID_SESSION_STATUS: "기록할 수 없는 상태예요.",
  // email sending (lib/email)
  EMAIL_COOLDOWN: "메일을 방금 보냈어요. 1분 뒤에 다시 시도해주세요.",
  EMAIL_HOURLY_LIMIT: "지금은 메일 요청이 많아요. 잠시 후 다시 시도해주세요.",
  EMAIL_NOT_CONFIGURED: "메일 발송 설정이 아직 끝나지 않았어요. 운영 사무국에 문의해주세요.",
  SERVICE_KEY_MISSING: "서버 설정이 아직 끝나지 않았어요. 운영 사무국에 문의해주세요.",
  SITE_URL_MISSING: "서버 설정이 아직 끝나지 않았어요. 운영 사무국에 문의해주세요.",
};

const FALLBACK = "문제가 생겼어요. 잠시 후 다시 시도해주세요.";
const NETWORK = "인터넷 연결이 불안정해요. 연결을 확인하고 다시 시도해주세요.";

/** The short code inside an error, if it is one of ours. */
export function errorCode(error) {
  const message = String(error?.message ?? "");
  return Object.keys(MESSAGES).find((code) => message === code || message.includes(code)) ?? null;
}

/** Human-readable Korean message for any error thrown by Supabase or fetch. */
export function toUserMessage(error) {
  if (!error) return null;
  const code = errorCode(error);
  if (code) return MESSAGES[code];
  const message = String(error.message ?? "");
  if (/failed to fetch|network|load failed/i.test(message)) return NETWORK;
  return FALLBACK;
}

/**
 * Auth error -> Korean message. Supabase Auth returns English messages and
 * `code` values; only the ones users can hit are mapped.
 */
export function authErrorMessage(error) {
  if (!error) return null;
  const code = error.code ?? "";
  const message = String(error.message ?? "");

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "이메일 또는 비밀번호가 맞지 않아요.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "이메일 인증이 아직 끝나지 않았어요. 인증 코드를 입력해주세요.";
  }
  if (code === "otp_expired" || /token has expired|invalid/i.test(message)) {
    return "인증 코드가 맞지 않거나 만료됐어요. 코드를 다시 받아주세요.";
  }
  if (code === "over_email_send_rate_limit" || /rate limit/i.test(message)) {
    return "메일을 너무 자주 요청했어요. 1분 정도 기다린 뒤 다시 시도해주세요.";
  }
  if (code === "same_password") return "이전과 다른 비밀번호를 입력해주세요.";
  if (code === "weak_password") return "비밀번호가 너무 단순해요. 영문과 숫자를 섞어 8자 이상으로 만들어주세요.";
  if (/database error saving new user/i.test(message)) return MESSAGES.SIGNUP_NOT_ALLOWED;
  return toUserMessage(error);
}
