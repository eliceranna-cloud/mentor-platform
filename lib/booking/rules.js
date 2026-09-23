import { MAX_SLOTS_PER_DAY, TIME_SLOTS } from "./constants";

/** Rule codes. Identical to the codes raised by public.slot_rule_violation(). */
export const RULE = {
  SAME_TIME: "RULE_SAME_TIME",
  DAILY_LIMIT: "RULE_DAILY_LIMIT",
  CONSECUTIVE: "RULE_CONSECUTIVE",
};

/** Short labels shown inside a blocked slot. */
export const RULE_SHORT_LABEL = {
  [RULE.SAME_TIME]: "시간 겹침",
  [RULE.DAILY_LIMIT]: "하루 2개",
  [RULE.CONSECUTIVE]: "연속만",
};

/**
 * Would booking `time` on `date` break a rule, given the slots the student
 * already holds or has selected? Returns a RULE code or null.
 *
 * This mirrors public.slot_rule_violation() so the board can grey out slots
 * before the student tries. The database check is the one that counts: two
 * tabs or a stale board can still be rejected there.
 *
 * @param {{date: string, time: string}[]} heldSlots
 */
export function slotRuleViolation(heldSlots, date, time) {
  const taken = heldSlots.filter((s) => s.date === date).map((s) => TIME_SLOTS.indexOf(s.time));
  const target = TIME_SLOTS.indexOf(time);

  if (taken.includes(target)) return RULE.SAME_TIME;
  if (taken.length >= MAX_SLOTS_PER_DAY) return RULE.DAILY_LIMIT;
  if (taken.length === 1 && Math.abs(taken[0] - target) !== 1) return RULE.CONSECUTIVE;
  return null;
}
