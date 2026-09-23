"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/booking/constants";
import { cn } from "@/lib/cn";

const MAX_VISIBLE_EVENTS = 3;

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // "2026-10"
}

function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Sunday-first grid of "YYYY-MM-DD" strings (null for padding cells). */
function monthGrid(key) {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array(first.getUTCDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${key}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * Month view of a mentor's schedule. Lightweight on purpose (no calendar
 * library): sessions only ever span a few weeks.
 *
 * @param period         { starts_on, ends_on } - navigation is limited to these months
 * @param eventsByDate   Map<date, [{ id, label }]>
 * @param onSelectDate   (date) => void, for days inside the period
 */
export function MonthCalendar({ period, eventsByDate, onSelectDate }) {
  const firstMonth = monthKey(period.starts_on);
  const lastMonth = monthKey(period.ends_on);
  const [month, setMonth] = useState(firstMonth);
  const cells = useMemo(() => monthGrid(month), [month]);
  const [year, monthNumber] = month.split("-").map(Number);

  const inPeriod = (date) => date >= period.starts_on && date <= period.ends_on;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <NavButton label="이전 달" disabled={month <= firstMonth} onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" aria-hidden />
        </NavButton>
        <NavButton label="다음 달" disabled={month >= lastMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight className="size-4" aria-hidden />
        </NavButton>
        <h2 className="tnum text-lg font-bold">
          {year}년 {monthNumber}월
        </h2>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-zinc-200" role="grid">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} role="columnheader" className="border-b border-zinc-200 bg-zinc-50 py-2 text-center text-[13px] font-semibold text-zinc-600">
            {label}
          </div>
        ))}
        {cells.map((date, i) => {
          const events = (date && eventsByDate.get(date)) || [];
          const active = date && inPeriod(date);
          const Tag = active ? "button" : "div";
          return (
            <Tag
              key={date ?? `pad-${i}`}
              role="gridcell"
              {...(active ? { type: "button", onClick: () => onSelectDate(date) } : {})}
              className={cn(
                "flex min-h-16 flex-col items-stretch gap-0.5 border-b border-r border-zinc-200 p-1 text-left sm:min-h-24 sm:p-1.5",
                (i + 1) % 7 === 0 && "border-r-0",
                active ? "bg-white hover:bg-blue-50/50" : "bg-zinc-50/60",
                !date && "bg-zinc-50"
              )}
              aria-label={date ? `${Number(date.slice(8))}일, 신청 ${events.length}건` : undefined}
            >
              {date && (
                <span className={cn("tnum px-1 text-[13px]", active ? "text-zinc-600" : "text-zinc-300")}>{Number(date.slice(8))}</span>
              )}
              {events.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                <span key={event.id} className="truncate rounded-md bg-blue-600 px-1 text-[11px] font-semibold text-white sm:text-xs">
                  {event.label}
                </span>
              ))}
              {events.length > MAX_VISIBLE_EVENTS && (
                <span className="px-1 text-[11px] text-zinc-600">+{events.length - MAX_VISIBLE_EVENTS}</span>
              )}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
