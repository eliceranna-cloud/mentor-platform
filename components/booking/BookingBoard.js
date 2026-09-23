"use client";

import { Info } from "lucide-react";
import { Fragment, useState } from "react";
import { Avatar } from "@/components/ui/Display";
import { SegmentedControl } from "@/components/ui/Tabs";
import { TIME_SLOTS } from "@/lib/booking/constants";
import { cn } from "@/lib/cn";

/**
 * Cell looks, by state. Every state also carries a text label (and usually an
 * icon), so it reads without colour.
 */
export const CELL_STYLES = {
  free: "border border-dashed border-blue-300 bg-white text-blue-600 hover:border-solid hover:border-blue-600 hover:bg-blue-50",
  selected: "border border-blue-600 bg-blue-600 text-white",
  mine: "border border-ink bg-ink text-white hover:bg-ink-hover",
  taken: "border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-default",
  blocked: "border border-dashed border-zinc-200 bg-white text-[11px] text-zinc-400 cursor-help",
  past: "border border-zinc-100 bg-zinc-50 text-zinc-300 cursor-default",
  off: "hatch border border-transparent cursor-default",
  empty: "border border-dashed border-zinc-300 bg-white text-zinc-400 hover:border-blue-600 hover:text-blue-600",
  "named-dn": "border border-region-dn bg-region-dn text-xs text-white hover:opacity-90",
  "named-cc": "border border-region-cc bg-region-cc text-xs text-white hover:opacity-90",
  moving: "border border-blue-600 bg-blue-100 text-blue-700",
};

/**
 * The date x (mentor x time) grid shared by the student and admin screens.
 *
 * Wide screens (>= 1024px) show every mentor side by side. Phones and
 * tablets show one mentor at a time with a picker, so the four time columns
 * stay large enough to tap.
 *
 * @param mentors   [{ id, name, field, region_group }]
 * @param dates     [{ date, monthDay, weekday, isMonday }]
 * @param getCell   (mentor, date, time) => { state, label?, Icon?, title, onClick? }
 * @param onMentorInfo  optional; mentor header becomes a button
 * @param showRegion    show the region in the mentor header (admin "전체" view)
 */
export function BookingBoard({ mentors, dates, getCell, onMentorInfo, showRegion = false }) {
  const [activeMentorId, setActiveMentorId] = useState(null);
  const active = mentors.find((m) => m.id === activeMentorId) ?? mentors[0];

  if (!mentors.length) return null;

  return (
    <>
      {/* Phones and tablets: one mentor at a time */}
      <div className="lg:hidden">
        <SegmentedControl
          scrollable
          label="멘토 선택"
          className="mb-3"
          value={active.id}
          onChange={setActiveMentorId}
          options={mentors.map((m) => ({ value: m.id, label: m.name }))}
        />
        <BoardTable mentors={[active]} dates={dates} getCell={getCell} onMentorInfo={onMentorInfo} showRegion={showRegion} />
      </div>

      {/* Desktop: all mentors, scrolls sideways if there are many */}
      <div className="hidden lg:block">
        <BoardTable mentors={mentors} dates={dates} getCell={getCell} onMentorInfo={onMentorInfo} showRegion={showRegion} />
      </div>
    </>
  );
}

// Fixed layout keeps every slot column the same width whatever its label;
// below this width per slot the board scrolls sideways instead of squashing.
const DATE_COLUMN_PX = 72;
const MIN_SLOT_PX = 64;
const GROUP_GAP_PX = 12; // empty column between two mentors

/** Empty cell that separates one mentor's four slots from the next mentor's. */
const Gap = ({ as: Tag = "td" }) => <Tag aria-hidden className="p-0" />;

function BoardTable({ mentors, dates, getCell, onMentorInfo, showRegion }) {
  const slotCount = mentors.length * TIME_SLOTS.length;
  const gapCount = mentors.length - 1;
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 sm:p-4">
      <table
        className="w-full table-fixed border-separate border-spacing-0.5"
        style={{ minWidth: DATE_COLUMN_PX + slotCount * MIN_SLOT_PX + gapCount * GROUP_GAP_PX }}
      >
        <colgroup>
          <col style={{ width: DATE_COLUMN_PX }} />
          {mentors.map((mentor, m) => (
            <Fragment key={mentor.id}>
              {m > 0 && <col style={{ width: GROUP_GAP_PX }} />}
              {TIME_SLOTS.map((time) => (
                <col key={time} />
              ))}
            </Fragment>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 z-[1] bg-white" />
            {mentors.map((mentor, m) => (
              <Fragment key={mentor.id}>
                {m > 0 && <Gap as="th" />}
                <th colSpan={TIME_SLOTS.length} className="pb-2 text-left font-normal">
                  <MentorHeader mentor={mentor} onInfo={onMentorInfo} showRegion={showRegion} />
                </th>
              </Fragment>
            ))}
          </tr>
          <tr>
            {mentors.map((mentor, m) => (
              <Fragment key={mentor.id}>
                {m > 0 && <Gap as="th" />}
                {TIME_SLOTS.map((time) => (
                  <th key={time} className="tnum pb-2 text-xs font-medium text-zinc-400">
                    {time}
                  </th>
                ))}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d, row) => (
            <tr key={d.date}>
              <th
                scope="row"
                className={cn(
                  "tnum sticky left-0 z-[1] whitespace-nowrap bg-white pr-2 text-left text-sm font-semibold",
                  d.isMonday && row > 0 && "pt-4"
                )}
              >
                {d.monthDay}
                <span className="ml-1 font-medium text-zinc-400">{d.weekday}</span>
              </th>
              {mentors.map((mentor, m) => (
                <Fragment key={mentor.id}>
                  {m > 0 && <Gap />}
                  {TIME_SLOTS.map((time) => (
                    <td key={time} className={cn(d.isMonday && row > 0 && "pt-4")}>
                      <SlotCell cell={getCell(mentor, d, time)} ariaContext={`${d.monthDay} ${d.weekday}요일 ${time} ${mentor.name} 멘토`} />
                    </td>
                  ))}
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MentorHeader({ mentor, onInfo, showRegion }) {
  const content = (
    <>
      <Avatar name={mentor.name} group={mentor.region_group} />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[15px] font-bold group-hover:text-blue-600">{mentor.name}</b>
        <small className="truncate text-xs text-zinc-600">
          {showRegion && `${mentor.region_group} · `}
          {mentor.field}
        </small>
      </span>
      {onInfo && <Info className="size-4 shrink-0 text-zinc-400" aria-hidden />}
    </>
  );
  const className = "group flex w-full items-center gap-2 border-b border-zinc-200 pb-2 text-left";
  if (!onInfo) return <div className={className}>{content}</div>;
  return (
    <button type="button" className={className} onClick={() => onInfo(mentor)} title="멘토 소개 보기">
      {content}
    </button>
  );
}

/** One slot button. Inert states render disabled; "blocked" stays clickable to explain why. */
function SlotCell({ cell, ariaContext }) {
  const { state, label, Icon, title, onClick } = cell;
  const inert = !onClick;
  return (
    <button
      type="button"
      disabled={inert}
      onClick={onClick}
      title={title}
      aria-label={`${ariaContext}, ${title || label || ""}`}
      className={cn(
        "flex h-10 w-full min-w-14 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-lg px-1 text-[13px] font-semibold transition-colors",
        CELL_STYLES[state]
      )}
    >
      {/* Narrow cells drop the icon so the text label (the real signal) fits. An icon-only cell keeps it. */}
      {Icon && <Icon className={cn("size-3.5 shrink-0", label && "hidden sm:block")} aria-hidden />}
      {label && <span className="truncate">{label}</span>}
    </button>
  );
}

/** Colour key under the toolbar. items: [{ state, label }] */
export function BoardLegend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-zinc-600">
      {items.map(({ state, label }) => (
        <span key={state} className="inline-flex items-center gap-2">
          <i className={cn("inline-block h-4 w-6 rounded", CELL_STYLES[state])} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
