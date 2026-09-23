// What a mentor records after a session has started (bookings.session_status).
// Values match the check constraint in the session_log migration.

export const SESSION_STATUS = {
  completed: { label: "완료", tone: "ok", mark: "✓" },
  cancelled: { label: "취소", tone: "neutral", mark: "✕" },
  rescheduled: { label: "일정 변경", tone: "blue", mark: "↻" },
};

export const SESSION_STATUS_ORDER = ["completed", "cancelled", "rescheduled"];
