"use client";

import { ArrowLeftRight, ArrowRight, Plus, Users } from "lucide-react";
import { useMemo } from "react";
import { BoardLegend, BookingBoard } from "@/components/booking/BookingBoard";
import { Toolbar } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { EmptyState, Hint } from "@/components/ui/Display";
import { REGION_TONE } from "@/lib/booking/constants";
import { formatDate, isSlotPast, isWithinPeriod } from "@/lib/booking/dates";

const slotKey = (mentorId, date, time) => `${mentorId}|${date}|${time}`;

/** Every mentor's slots with student names. Click a booking to manage it, an empty slot to assign. */
export function BoardTab({ mentors, dates, regionByName, bookings, moving, busy, showRegion, onOpenBooking, onAssign, onMoveTo, onCancelMove }) {
  const bookingBySlot = useMemo(
    () => new Map(bookings.map((b) => [slotKey(b.mentor_id, b.booking_date, b.booking_time), b])),
    [bookings]
  );

  function getCell(mentor, day, time) {
    if (!isWithinPeriod(regionByName.get(mentor.region_group), day.date)) {
      return { state: "off", title: `${mentor.region_group} 멘토링 기간이 아니에요` };
    }

    const booking = bookingBySlot.get(slotKey(mentor.id, day.date, time));
    if (booking) {
      if (moving?.id === booking.id) {
        return { state: "moving", label: "이동 중", Icon: ArrowLeftRight, title: "옮길 빈 칸을 누르세요" };
      }
      const student = booking.students;
      return {
        state: `named-${REGION_TONE[mentor.region_group]}`,
        label: student?.name ?? "학생",
        title: `${student?.name} · ${student?.phone} · ${mentor.region_group}`,
        onClick: () => onOpenBooking(booking),
      };
    }

    if (isSlotPast(day.date, time)) return { state: "past", title: "지난 시간이에요" };
    const slot = { mentorId: mentor.id, date: day.date, time };
    if (moving) {
      return { state: "free", label: "여기로", Icon: ArrowRight, title: "이 시간으로 옮기기", onClick: () => !busy && onMoveTo(slot) };
    }
    return { state: "empty", Icon: Plus, title: "빈 시간 · 학생을 지정해 예약", onClick: () => onAssign(slot) };
  }

  if (!mentors.length) return <EmptyState Icon={Users} message="이 조건에 맞는 멘토가 없어요." />;

  return (
    <section aria-label="예약 보드">
      {moving && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          <ArrowLeftRight className="size-4" aria-hidden />
          {moving.students?.name} 학생의 {formatDate(moving.booking_date)} {moving.booking_time} 예약을 옮기는 중이에요. 옮길 빈 칸을 눌러주세요.
          <Button variant="outline" size="sm" className="ml-auto" onClick={onCancelMove}>
            그만두기
          </Button>
        </div>
      )}
      <Toolbar>
        <p className="flex items-center gap-2 text-[13px] text-zinc-600">
          <Users className="size-4" aria-hidden />
          멘토 {mentors.length}명
        </p>
        <BoardLegend
          items={[
            { state: "named-dn", label: "동남권 예약" },
            { state: "named-cc", label: "충청권 예약" },
            { state: "empty", label: "빈 시간 · 눌러서 지정 예약" },
          ]}
        />
      </Toolbar>
      <Hint>예약된 칸을 누르면 학생 정보와 함께 이동·취소할 수 있어요. 빈 칸을 누르면 학생을 지정해 예약할 수 있어요.</Hint>
      <BookingBoard mentors={mentors} dates={dates} getCell={getCell} showRegion={showRegion} />
    </section>
  );
}
