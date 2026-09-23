// Account status labels shown in the admin lists. Each is a text label (and
// chip tone), never colour alone.

/** Mentor or admin invitation lifecycle. */
export function inviteStatus({ email, invited_at: invitedAt, activated_at: activatedAt }) {
  if (activatedAt) return { label: "활성", tone: "ok" };
  if (invitedAt) return { label: "초대됨", tone: "blue" };
  if (!email) return { label: "이메일 없음", tone: "neutral" };
  return { label: "초대 전", tone: "neutral" };
}

/** Label for the invite button, matching the current status. */
export function inviteActionLabel(row) {
  if (row.activated_at) return "비밀번호 재설정 메일";
  if (row.invited_at) return "초대 재발송";
  return "초대 메일 보내기";
}

/** Student sign-up status from public.admin_student_roster(). */
export const STUDENT_STATUS = {
  active: { label: "가입 완료", tone: "ok" },
  pending_verification: { label: "인증 대기", tone: "warn" },
  not_signed_up: { label: "미가입", tone: "neutral" },
  legacy: { label: "이전 기록", tone: "neutral" },
};
