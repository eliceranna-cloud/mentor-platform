import { describe, expect, it } from "vitest";
import {
  buildSessionDates,
  endTime,
  formatDate,
  isSlotPast,
  mergeSessionDates,
  nowInKst,
} from "@/lib/booking/dates";

const DONGNAM = { name: "동남권", starts_on: "2026-10-12", ends_on: "2026-10-23" };
const CHUNGCHEONG = { name: "충청권", starts_on: "2026-10-13", ends_on: "2026-10-30" };

describe("buildSessionDates", () => {
  it("lists weekdays only, inclusive of both ends", () => {
    const dates = buildSessionDates(DONGNAM.starts_on, DONGNAM.ends_on);
    expect(dates).toHaveLength(10); // two full Mon-Fri weeks
    expect(dates[0]).toMatchObject({ date: "2026-10-12", monthDay: "10/12", weekday: "월", isMonday: true });
    expect(dates.at(-1)).toMatchObject({ date: "2026-10-23", weekday: "금" });
    expect(dates.some((d) => d.weekday === "토" || d.weekday === "일")).toBe(false);
  });

  it("gives 충청권 14 session days", () => {
    expect(buildSessionDates(CHUNGCHEONG.starts_on, CHUNGCHEONG.ends_on)).toHaveLength(14);
  });
});

describe("mergeSessionDates", () => {
  it("unions regions without duplicates, in order", () => {
    const merged = mergeSessionDates([CHUNGCHEONG, DONGNAM]);
    expect(merged[0].date).toBe("2026-10-12");
    expect(merged.at(-1).date).toBe("2026-10-30");
    expect(new Set(merged.map((d) => d.date)).size).toBe(merged.length);
  });
});

describe("formatting", () => {
  it("formats dates and slot end times", () => {
    expect(formatDate("2026-10-12")).toBe("10/12(월)");
    expect(endTime("19:30")).toBe("20:00");
    expect(endTime("20:30")).toBe("21:00");
  });
});

describe("KST handling", () => {
  it("converts UTC to Korean time (UTC+9) across the date line", () => {
    // 2026-10-12 15:30 UTC is 2026-10-13 00:30 in Korea
    expect(nowInKst(new Date("2026-10-12T15:30:00Z"))).toEqual({ date: "2026-10-13", time: "00:30" });
  });

  it("treats a slot as past once it has started in KST", () => {
    const at1900Kst = new Date("2026-10-12T10:00:00Z");
    expect(isSlotPast("2026-10-12", "19:00", at1900Kst)).toBe(true);
    expect(isSlotPast("2026-10-12", "19:30", at1900Kst)).toBe(false);
    expect(isSlotPast("2026-10-11", "20:30", at1900Kst)).toBe(true);
  });
});
