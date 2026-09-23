"use client";

import { CalendarCheck, CalendarDays, CalendarX, ChevronRight, ClipboardCheck, Clock, MapPin, Phone, User, Users, Video } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BookingRow } from "@/components/booking/BookingRow";
import { MonthCalendar } from "@/components/booking/MonthCalendar";
import { SessionStatusPicker } from "@/components/booking/SessionStatusPicker";
import { PageContainer, PageHero } from "@/components/layout/Page";
import { ContextChip, TopBar } from "@/components/layout/TopBar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState, Hint, KpiGrid } from "@/components/ui/Display";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/Tabs";
import { TIME_SLOTS } from "@/lib/booking/constants";
import { buildSessionDates, bySlot, endTime, formatDate, formatPeriod, isSlotPast } from "@/lib/booking/dates";
import { MENTOR_BOOKING_COLUMNS } from "@/lib/booking/queries";
import { SESSION_STATUS } from "@/lib/booking/session";
import { useBookingsRealtime } from "@/lib/hooks/useBookingsRealtime";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Mentor home: who booked which evening, their contacts, and the classroom link. */
export function MentorApp({ mentor, region, initialBookings }) {
  const supabase = getSupabaseBrowserClient();
  const [bookings, setBookings] = useState(initialBookings);
  const [chosenView, setView] = useState(null);
  const [openDate, setOpenDate] = useState(null);

  // Until the mentor picks, phones get the list: a 7-column calendar with
  // names is cramped there.
  const isPhone = useMediaQuery("(max-width: 639px)");
  const view = chosenView ?? (isPhone ? "list" : "calendar");

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select(MENTOR_BOOKING_COLUMNS)
      .eq("mentor_id", mentor.id)
      .is("cancelled_at", null);
    if (!error) setBookings(data);
  }, [supabase, mentor.id]);

  useBookingsRealtime(`mentor-${mentor.id}`, reload);

  const sorted = useMemo(() => [...bookings].sort(bySlot), [bookings]);
  const byDate = useMemo(() => {
    const map = new Map();
    sorted.forEach((b) => map.set(b.booking_date, [...(map.get(b.booking_date) ?? []), b]));
    return map;
  }, [sorted]);
  const calendarEvents = useMemo(
    () => new Map([...byDate].map(([date, list]) => [date, list.map((b) => ({ id: b.id, label: sessionLabel(b) }))])),
    [byDate]
  );

  const totalSlots = buildSessionDates(region.starts_on, region.ends_on).length * TIME_SLOTS.length;
  const studentCount = new Set(bookings.map((b) => b.student_id)).size;
  // Sessions that have started but have no outcome recorded yet.
  const unlogged = sorted.filter((b) => !b.session_status && isSlotPast(b.booking_date, b.booking_time));

  return (
    <>
      <TopBar name={mentor.name} roleLabel="멘토" context={<ContextChip Icon={MapPin}>{mentor.region_group}</ContextChip>} />
      <PageContainer>
        <PageHero
          title={`${mentor.name} 멘토님의 멘토링 일정`}
          meta={[
            { Icon: User, text: mentor.field },
            { Icon: CalendarDays, text: formatPeriod(region) },
            { Icon: Clock, text: "평일 저녁 19:00~21:00" },
          ]}
          aside={
            <div className="flex flex-wrap items-center gap-2">
              {mentor.meeting_link && (
                <Button variant="blue" href={mentor.meeting_link} external>
                  <Video className="size-4" aria-hidden />내 라이브 강의실
                </Button>
              )}
              <SegmentedControl
                label="보기 방식"
                value={view}
                onChange={setView}
                options={[
                  { value: "calendar", label: "달력" },
                  { value: "list", label: "목록" },
                ]}
              />
            </div>
          }
        />

        <KpiGrid
          items={[
            { label: "신청된 멘토링", value: `${bookings.length}건`, sub: `전체 ${totalSlots}칸 중`, Icon: CalendarCheck },
            { label: "신청 학생", value: `${studentCount}명`, sub: "중복 제외", Icon: Users },
            { label: "남은 빈 시간", value: `${totalSlots - bookings.length}칸`, sub: "학생이 예약할 수 있어요", Icon: Clock },
            {
              label: "라이브 강의실",
              value: mentor.meeting_link ? "연결됨" : "준비중",
              sub: mentor.meeting_link ? "바로 입장할 수 있어요" : "운영 사무국에 문의하세요",
              Icon: Video,
            },
          ]}
        />

        {unlogged.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <ClipboardCheck className="size-4" aria-hidden />
            세션 결과를 기록해주세요 · {unlogged.length}건 (완료, 취소, 일정 변경)
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setOpenDate(unlogged[0].booking_date)}>
              기록하기
            </Button>
          </div>
        )}

        {view === "calendar" ? (
          <>
            <MonthCalendar period={region} eventsByDate={calendarEvents} onSelectDate={setOpenDate} />
            <Hint className="mt-4">날짜를 누르면 그날 시간대별 신청 학생과 연락처를 볼 수 있어요. 세션이 끝나면 여기서 결과를 기록해주세요.</Hint>
          </>
        ) : byDate.size ? (
          <div className="flex flex-col gap-2">
            {[...byDate].map(([date, list]) => (
              <BookingRow
                key={date}
                date={date}
                onClick={() => setOpenDate(date)}
                title={list.map(sessionLabel).join(" · ")}
                subtitle={`${list.length}명 신청`}
                actions={<ChevronRight className="hidden size-4 text-zinc-400 sm:block" aria-hidden />}
              />
            ))}
          </div>
        ) : (
          <EmptyState Icon={CalendarX} message="아직 신청된 멘토링이 없어요." />
        )}
      </PageContainer>

      {openDate && (
        <DayModal
          date={openDate}
          bookings={byDate.get(openDate) ?? []}
          meetingLink={mentor.meeting_link}
          onLogged={reload}
          onClose={() => setOpenDate(null)}
        />
      )}
    </>
  );
}

/** "✓ 19:00 홍길동" – time and student, prefixed with the recorded outcome if any. */
function sessionLabel(booking) {
  const mark = SESSION_STATUS[booking.session_status]?.mark;
  return `${mark ? `${mark} ` : ""}${booking.booking_time} ${booking.students?.name ?? ""}`;
}

/**
 * Four slots of one evening with the booked student's contact details.
 * Once a slot has started, the mentor records its outcome here.
 */
function DayModal({ date, bookings, meetingLink, onLogged, onClose }) {
  const byTime = new Map(bookings.map((b) => [b.booking_time, b]));
  return (
    <Modal
      title={`${formatDate(date)} 일정`}
      description={`${bookings.length}명 신청 · 미참석 시 연락처로 연락해주세요`}
      onClose={onClose}
      footer={<Button onClick={onClose}>닫기</Button>}
    >
      <ul>
        {TIME_SLOTS.map((time) => {
          const booking = byTime.get(time);
          const started = isSlotPast(date, time);
          return (
            <li key={time} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-zinc-200 py-3 [&+&]:border-t">
              <span className="tnum w-28 shrink-0 text-sm font-bold">
                {time} ~ {endTime(time)}
              </span>
              {booking ? (
                <span className="min-w-0 flex-1">
                  <b className="text-sm">{booking.students?.name}</b>
                  <small className="tnum block text-[13px] text-zinc-600">
                    <a href={`tel:${booking.students?.phone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone className="size-3" aria-hidden />
                      {booking.students?.phone}
                    </a>
                    {booking.students?.region && <span> · {booking.students.region}</span>}
                  </small>
                </span>
              ) : (
                <span className="text-sm text-zinc-400">비어있음</span>
              )}
              {booking && started && (
                <div className="w-full pl-0 sm:pl-[124px]">
                  <SessionStatusPicker bookingId={booking.id} status={booking.session_status} onSaved={onLogged} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {meetingLink && (
        <Alert tone="info" icon={Video} className="mt-4">
          <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            내 라이브 강의실로 입장하기
          </a>
        </Alert>
      )}
    </Modal>
  );
}
