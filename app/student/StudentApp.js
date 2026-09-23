"use client";

import {
  ArrowLeftRight,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Check,
  Clock,
  Lock,
  MapPin,
  Video,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BoardLegend, BookingBoard } from "@/components/booking/BookingBoard";
import { BookingRow } from "@/components/booking/BookingRow";
import { ConfirmModal, MentorInfoModal, SlotSummary } from "@/components/booking/Modals";
import { SelectionTray } from "@/components/booking/SelectionTray";
import { SessionStatusChip } from "@/components/booking/SessionStatusPicker";
import { ContextChip, TopBar } from "@/components/layout/TopBar";
import { PageContainer, PageHero, Toolbar } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState, Hint } from "@/components/ui/Display";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { buildSessionDates, formatDate, formatPeriod, isSlotPast } from "@/lib/booking/dates";
import { RULE_SHORT_LABEL, slotRuleViolation } from "@/lib/booking/rules";
import { errorCode, toUserMessage } from "@/lib/errors";
import { useBookingsRealtime } from "@/lib/hooks/useBookingsRealtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const slotKey = (mentorId, date, time) => `${mentorId}|${date}|${time}`;

/**
 * Student home: book free slots of mentors in the student's own region, and
 * manage (join, move, cancel) their bookings.
 */
export function StudentApp({ initialBoard, initialBookings }) {
  const supabase = getSupabaseBrowserClient();
  const toast = useToast();

  const [board, setBoard] = useState(initialBoard);
  const [bookings, setBookings] = useState(initialBookings ?? []);
  const [tab, setTab] = useState("book");
  const [pending, setPending] = useState([]); // picked, not yet confirmed
  const [moving, setMoving] = useState(null); // booking being moved to another slot
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [nextBoard, nextBookings] = await Promise.all([supabase.rpc("student_board"), supabase.rpc("student_bookings")]);
    if (!nextBoard.error) setBoard(nextBoard.data);
    if (!nextBookings.error) setBookings(nextBookings.data ?? []);
    return nextBoard.data;
  }, [supabase]);

  useBookingsRealtime("student-board", reload);

  const { student, region, mentors = [], taken = [] } = board ?? {};
  const dates = useMemo(() => (region ? buildSessionDates(region.starts_on, region.ends_on) : []), [region]);
  const mentorById = useMemo(() => new Map(mentors.map((m) => [m.id, m])), [mentors]);
  const takenBySlot = useMemo(() => new Map(taken.map((t) => [slotKey(t.mentor_id, t.date, t.time), t])), [taken]);
  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  // Slots that count toward the per-day rules: confirmed bookings (minus the
  // one being moved) plus what is sitting in the tray.
  const heldSlots = useMemo(
    () => [
      ...bookings.filter((b) => b.id !== moving?.id).map((b) => ({ date: b.booking_date, time: b.booking_time })),
      ...pending,
    ],
    [bookings, pending, moving]
  );

  const upcoming = bookings.filter((b) => !isSlotPast(b.booking_date, b.booking_time));

  if (!student) {
    return (
      <PageContainer>
        <Alert tone="error">학생 정보를 불러오지 못했어요. 새로고침하거나 운영 사무국에 문의해주세요.</Alert>
      </PageContainer>
    );
  }

  /* ---------- actions ---------- */

  function togglePending(mentorId, date, time) {
    setPending((list) => {
      const exists = list.some((s) => slotKey(s.mentorId, s.date, s.time) === slotKey(mentorId, date, time));
      return exists
        ? list.filter((s) => slotKey(s.mentorId, s.date, s.time) !== slotKey(mentorId, date, time))
        : [...list, { mentorId, date, time }];
    });
  }

  async function confirmPending() {
    setBusy(true);
    const slots = pending.map((s) => ({ mentor_id: s.mentorId, date: s.date, time: s.time }));
    const { data, error } = await supabase.rpc("book_slots", { p_slots: slots });
    setBusy(false);

    if (error) {
      toast(toUserMessage(error), "error");
      // Someone else was faster: refresh and drop the slots that are gone.
      if (errorCode(error) === "SLOT_TAKEN") {
        const fresh = await reload();
        const nowTaken = new Set((fresh?.taken ?? []).map((t) => slotKey(t.mentor_id, t.date, t.time)));
        setPending((list) => list.filter((s) => !nowTaken.has(slotKey(s.mentorId, s.date, s.time))));
      }
      return;
    }
    setPending([]);
    setModal({ type: "booked", list: data ?? [] });
    reload();
  }

  async function cancelBooking(booking) {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_booking", { p_booking_id: booking.id });
    setBusy(false);
    setModal(null);
    if (error) return toast(toUserMessage(error), "error");
    if (moving?.id === booking.id) setMoving(null);
    toast("예약을 취소했어요");
    reload();
  }

  function startMove(booking) {
    setPending([]);
    setMoving(booking);
    setTab("book");
    toast("옮길 빈 칸을 눌러주세요", "info");
  }

  async function moveTo(mentorId, date, time) {
    setBusy(true);
    const { error } = await supabase.rpc("move_booking", {
      p_booking_id: moving.id,
      p_mentor_id: mentorId,
      p_date: date,
      p_time: time,
    });
    setBusy(false);
    if (error) {
      toast(toUserMessage(error), "error");
      return reload();
    }
    setMoving(null);
    setTab("mine");
    toast("예약을 옮겼어요");
    reload();
  }

  /* ---------- board cells ---------- */

  function getCell(mentor, day, time) {
    const takenSlot = takenBySlot.get(slotKey(mentor.id, day.date, time));
    const past = isSlotPast(day.date, time);

    if (takenSlot) {
      if (moving?.id === takenSlot.id) {
        return { state: "moving", label: "이동 중", Icon: ArrowLeftRight, title: "이 예약을 옮기는 중이에요" };
      }
      if (takenSlot.mine) {
        const booking = bookingById.get(takenSlot.id);
        return past || !booking
          ? { state: "mine", label: "내 예약", Icon: Check, title: "지난 예약이에요" }
          : {
              state: "mine",
              label: "내 예약",
              Icon: Check,
              title: "내 예약 · 누르면 취소할 수 있어요",
              onClick: () => setModal({ type: "cancel", booking }),
            };
      }
      return { state: "taken", label: "마감", Icon: Lock, title: "다른 학생이 예약했어요" };
    }

    if (past) return { state: "past", label: "지남", title: "이미 지난 시간이에요" };

    const isPicked = pending.some((s) => slotKey(s.mentorId, s.date, s.time) === slotKey(mentor.id, day.date, time));
    if (isPicked) {
      return { state: "selected", label: "선택됨", Icon: Check, title: "선택됨 · 누르면 선택 해제", onClick: () => togglePending(mentor.id, day.date, time) };
    }

    const rule = slotRuleViolation(heldSlots, day.date, time);
    if (rule) {
      const message = toUserMessage({ message: rule });
      return { state: "blocked", label: RULE_SHORT_LABEL[rule], title: message, onClick: () => toast(message, "error") };
    }

    if (moving) {
      return { state: "free", label: "여기로", Icon: ArrowRight, title: "이 시간으로 옮기기", onClick: () => !busy && moveTo(mentor.id, day.date, time) };
    }
    return { state: "free", label: "가능", title: "예약 가능", onClick: () => togglePending(mentor.id, day.date, time) };
  }

  /* ---------- render ---------- */

  const nextSession = upcoming[0];
  const trayItems = pending.map((s) => ({
    key: slotKey(s.mentorId, s.date, s.time),
    ...s,
    mentorName: mentorById.get(s.mentorId)?.name ?? "",
  }));

  return (
    <>
      <TopBar
        name={student.name}
        roleLabel="학생"
        context={
          <ContextChip Icon={MapPin}>
            {student.region_group} · {student.region}
          </ContextChip>
        }
      />
      <PageContainer>
        <PageHero
          title={`${student.name}님, 원하는 시간을 골라주세요`}
          meta={[
            { Icon: MapPin, text: `${student.region_group} · ${student.region}` },
            { Icon: CalendarDays, text: formatPeriod(region) },
            { Icon: Clock, text: "평일 저녁 19:00~21:00, 30분 단위" },
          ]}
          aside={<NextSessionCard booking={nextSession} onShowMine={() => setTab("mine")} />}
        />

        <Tabs
          label="예약 화면"
          value={tab}
          onChange={setTab}
          items={[
            { value: "book", label: "예약하기" },
            { value: "mine", label: "내 예약", count: upcoming.length },
          ]}
        />

        {tab === "book" ? (
          <section aria-label="예약하기">
            {moving && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                <ArrowLeftRight className="size-4" aria-hidden />
                {formatDate(moving.booking_date)} {moving.booking_time} 예약을 옮기는 중이에요. 옮길 빈 칸을 눌러주세요.
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => setMoving(null)}>
                  그만두기
                </Button>
              </div>
            )}
            <Toolbar>
              <p className="flex items-center gap-2 text-[13px] text-zinc-600">
                <MapPin className="size-4" aria-hidden />
                {region.name} 멘토 {mentors.length}명 모두 예약할 수 있어요
              </p>
              <BoardLegend
                items={[
                  { state: "free", label: "예약 가능" },
                  { state: "selected", label: "선택됨" },
                  { state: "mine", label: "내 예약" },
                  { state: "taken", label: "마감" },
                ]}
              />
            </Toolbar>
            <Hint>
              하루 최대 2개(1시간)까지 예약할 수 있어요. 1시간을 하려면 이어지는 2개 시간을 골라주세요. 라이브 강의실 링크는 예약한 뒤
              &apos;내 예약&apos;에서 보여요.
            </Hint>
            {mentors.length ? (
              <BookingBoard mentors={mentors.map((m) => ({ ...m, region_group: region.name }))} dates={dates} getCell={getCell} onMentorInfo={(mentor) => setModal({ type: "mentor", mentor })} />
            ) : (
              <EmptyState Icon={CalendarX} message="아직 예약할 수 있는 멘토가 없어요. 운영 사무국에 문의해주세요." />
            )}
          </section>
        ) : (
          <MyBookings bookings={bookings} onMove={startMove} onCancel={(booking) => setModal({ type: "cancel", booking })} onGoBook={() => setTab("book")} />
        )}
      </PageContainer>

      {tab === "book" && !moving && (
        <SelectionTray
          slots={trayItems}
          confirming={busy}
          onConfirm={confirmPending}
          onRemove={(slot) => togglePending(slot.mentorId, slot.date, slot.time)}
        />
      )}

      {modal?.type === "mentor" && <MentorInfoModal mentor={{ ...modal.mentor, region_group: region.name }} onClose={() => setModal(null)} />}

      {modal?.type === "cancel" && (
        <ConfirmModal
          title="예약을 취소할까요?"
          description="취소하면 그 시간은 다른 학생이 예약할 수 있어요."
          confirmLabel="예약 취소"
          busy={busy}
          onConfirm={() => cancelBooking(modal.booking)}
          onClose={() => setModal(null)}
        >
          <SlotSummary
            date={modal.booking.booking_date}
            time={modal.booking.booking_time}
            mentorLabel={`${modal.booking.mentor_name} · ${modal.booking.mentor_field}`}
          />
        </ConfirmModal>
      )}

      {modal?.type === "booked" && (
        <Modal
          title="예약이 완료됐어요"
          description="라이브 강의실 링크는 '내 예약'에서 볼 수 있어요."
          onClose={() => setModal(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setModal(null)}>
                계속 예약하기
              </Button>
              <Button
                onClick={() => {
                  setModal(null);
                  setTab("mine");
                }}
              >
                내 예약 보기
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            {modal.list.map((b) => {
              const mentor = mentorById.get(b.mentor_id);
              return <SlotSummary key={b.id} date={b.booking_date} time={b.booking_time} mentorLabel={`${mentor?.name} · ${mentor?.field}`} />;
            })}
          </div>
        </Modal>
      )}
    </>
  );
}

function NextSessionCard({ booking, onShowMine }) {
  return (
    <div className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:min-w-[280px]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        {booking ? <CalendarCheck className="size-4" aria-hidden /> : <CalendarDays className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-zinc-600">다음 멘토링</p>
        {booking ? (
          <>
            <p className="tnum text-[15px] font-semibold">
              {formatDate(booking.booking_date)} {booking.booking_time}
            </p>
            <p className="truncate text-[13px] text-zinc-600">
              {booking.mentor_name} · {booking.mentor_field}
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-semibold">아직 예약이 없어요</p>
            <p className="text-[13px] text-zinc-600">아래 표에서 빈 칸을 눌러 예약하세요</p>
          </>
        )}
      </div>
      {booking && (
        <Button variant="outline" size="sm" onClick={onShowMine}>
          내 예약
        </Button>
      )}
    </div>
  );
}

function MyBookings({ bookings, onMove, onCancel, onGoBook }) {
  if (!bookings.length) {
    return (
      <EmptyState
        Icon={CalendarX}
        message="아직 예약한 멘토링이 없어요."
        action={<Button onClick={onGoBook}>예약하러 가기</Button>}
      />
    );
  }
  return (
    <section aria-label="내 예약">
      <Hint>예약 시간이 되면 라이브 강의실 입장을 누르세요. 변경을 누르면 다른 빈 시간으로 옮길 수 있어요.</Hint>
      <div className="flex flex-col gap-2">
        {bookings.map((b) => {
          const past = isSlotPast(b.booking_date, b.booking_time);
          return (
            <BookingRow
              key={b.id}
              date={b.booking_date}
              time={b.booking_time}
              muted={past && !b.session_status}
              title={<SessionStatusChip status={b.session_status} />}
              subtitle={`${b.mentor_name} · ${b.mentor_field}`}
              actions={
                <>
                  {b.meeting_link ? (
                    <Button variant="blue" size="sm" href={b.meeting_link} external>
                      <Video className="size-4" aria-hidden />
                      라이브 강의실 입장
                    </Button>
                  ) : (
                    <Button size="sm" disabled title="운영진이 링크를 등록하면 열려요">
                      <Clock className="size-4" aria-hidden />
                      링크 준비중
                    </Button>
                  )}
                  {!past && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => onMove(b)}>
                        <ArrowLeftRight className="size-4" aria-hidden />
                        변경
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onCancel(b)}>
                        취소
                      </Button>
                    </>
                  )}
                </>
              }
            />
          );
        })}
      </div>
    </section>
  );
}
