"use client";

import { ArrowRight, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/booking/dates";

/**
 * Fixed bar at the bottom listing picked-but-unconfirmed slots.
 * slots: [{ key, date, time, mentorName }]
 */
export function SelectionTray({ slots, onRemove, onConfirm, confirming }) {
  if (!slots.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white shadow-tray">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-4 py-3 pb-safe sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-4">
        <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto" aria-label="선택한 시간">
          {slots.map((slot) => (
            <li
              key={slot.key}
              className="tnum inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-blue-50 pl-3 pr-1 text-[13px] font-semibold text-blue-700"
            >
              <Clock className="size-3.5" aria-hidden />
              {formatDate(slot.date)} {slot.time} · {slot.mentorName}
              <button
                type="button"
                onClick={() => onRemove(slot)}
                aria-label={`${formatDate(slot.date)} ${slot.time} 선택 해제`}
                className="flex size-6 items-center justify-center rounded-full hover:bg-blue-100"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center justify-between gap-4">
          <span className="text-sm text-zinc-600">
            총 <b className="text-blue-600">{slots.length}개</b> 선택됨
          </span>
          <Button onClick={onConfirm} loading={confirming}>
            예약 확정
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
