import { KST_TIME_ZONE, SLOT_MINUTES, WEEKDAY_LABELS } from "./constants";

// Session dates are plain calendar days in Korea ("2026-10-12"). They are
// handled as UTC-midnight Date objects purely for arithmetic, so the user's
// own device time zone can never shift a day.

function parseDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" string. */
export function weekdayOf(dateStr) {
  return parseDay(dateStr).getUTCDay();
}

/** "2026-10-12" -> { date, monthDay: "10/12", weekday: "월", isMonday } */
export function describeDate(dateStr) {
  const day = parseDay(dateStr);
  const weekday = day.getUTCDay();
  return {
    date: dateStr,
    monthDay: `${day.getUTCMonth() + 1}/${day.getUTCDate()}`,
    weekday: WEEKDAY_LABELS[weekday],
    isMonday: weekday === 1,
  };
}

/** Every weekday (Mon to Fri) from startsOn to endsOn inclusive. */
export function buildSessionDates(startsOn, endsOn) {
  const dates = [];
  const end = parseDay(endsOn);
  for (let day = parseDay(startsOn); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(describeDate(toDateStr(day)));
  }
  return dates;
}

/** Union of several regions' session dates, sorted, without duplicates. */
export function mergeSessionDates(regions) {
  const byDate = new Map();
  regions.forEach((region) =>
    buildSessionDates(region.starts_on, region.ends_on).forEach((d) => byDate.set(d.date, d))
  );
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function isWithinPeriod(region, dateStr) {
  return dateStr >= region.starts_on && dateStr <= region.ends_on;
}

/** "2026-10-12" -> "10/12(월)" */
export function formatDate(dateStr) {
  const d = describeDate(dateStr);
  return `${d.monthDay}(${d.weekday})`;
}

/** "19:30" -> "20:00" (end of a 30-minute slot) */
export function endTime(time) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + SLOT_MINUTES;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "10/12(월) ~ 10/23(금)" for a region's session period. */
export function formatPeriod(region) {
  return `${formatDate(region.starts_on)} ~ ${formatDate(region.ends_on)}`;
}

const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Current Korean date and time, whatever the device's time zone. */
export function nowInKst(now = new Date()) {
  const parts = Object.fromEntries(kstFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * True once the slot has started (KST). The database applies the same cut-off,
 * so this only decides what the UI offers.
 */
export function isSlotPast(dateStr, time, now = new Date()) {
  const kst = nowInKst(now);
  return `${dateStr} ${time}` <= `${kst.date} ${kst.time}`;
}

/** Sort comparator for anything with booking_date + booking_time. */
export function bySlot(a, b) {
  return `${a.booking_date} ${a.booking_time}`.localeCompare(`${b.booking_date} ${b.booking_time}`);
}
