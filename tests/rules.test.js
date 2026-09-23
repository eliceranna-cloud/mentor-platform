import { describe, expect, it } from "vitest";
import { RULE, slotRuleViolation } from "@/lib/booking/rules";

const DAY = "2026-10-12";
const held = (...times) => times.map((time) => ({ date: DAY, time }));

describe("slotRuleViolation (mirror of public.slot_rule_violation)", () => {
  it("allows the first slot of a day", () => {
    expect(slotRuleViolation([], DAY, "19:00")).toBeNull();
  });

  it("allows an adjacent second slot, before or after", () => {
    expect(slotRuleViolation(held("19:30"), DAY, "20:00")).toBeNull();
    expect(slotRuleViolation(held("19:30"), DAY, "19:00")).toBeNull();
  });

  it("rejects a non-adjacent second slot", () => {
    expect(slotRuleViolation(held("19:00"), DAY, "20:00")).toBe(RULE.CONSECUTIVE);
    expect(slotRuleViolation(held("19:00"), DAY, "20:30")).toBe(RULE.CONSECUTIVE);
  });

  it("rejects a third slot on the same day", () => {
    expect(slotRuleViolation(held("19:00", "19:30"), DAY, "20:00")).toBe(RULE.DAILY_LIMIT);
  });

  it("rejects the same time with another mentor", () => {
    expect(slotRuleViolation(held("19:00"), DAY, "19:00")).toBe(RULE.SAME_TIME);
  });

  it("ignores other days", () => {
    const otherDay = [{ date: "2026-10-13", time: "19:00" }, { date: "2026-10-13", time: "19:30" }];
    expect(slotRuleViolation(otherDay, DAY, "20:30")).toBeNull();
  });
});
