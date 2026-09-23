// Booking constants shared by every role's screen.
// The database has the same values (public.time_slots()); keep them in sync.

/** The four evening slots, 30 minutes each, in KST. Order defines "consecutive". */
export const TIME_SLOTS = ["19:00", "19:30", "20:00", "20:30"];

export const SLOT_MINUTES = 30;

/** A student may book at most this many slots on one day (i.e. one hour). */
export const MAX_SLOTS_PER_DAY = 2;

/** All session dates and times are Korean wall-clock time. */
export const KST_TIME_ZONE = "Asia/Seoul";

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** Visual tone per region, used for chips and admin board cells. */
export const REGION_TONE = { 동남권: "dn", 충청권: "cc" };

/** Region filter values on the admin dashboard. */
export const ALL_REGIONS = "전체";
