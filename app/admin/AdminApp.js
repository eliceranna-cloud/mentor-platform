"use client";

import { CalendarCheck, CalendarDays, CircleCheck, Clock, ShieldCheck, User, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmModal, SlotSummary } from "@/components/booking/Modals";
import { PageContainer, PageHero } from "@/components/layout/Page";
import { ContextChip, TopBar } from "@/components/layout/TopBar";
import { Alert } from "@/components/ui/Alert";
import { KpiGrid } from "@/components/ui/Display";
import { SegmentedControl, Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { ALL_REGIONS, TIME_SLOTS } from "@/lib/booking/constants";
import { buildSessionDates, formatDate, formatPeriod, mergeSessionDates } from "@/lib/booking/dates";
import { errorCode, toUserMessage } from "@/lib/errors";
import { AssignBookingModal, BookingDetailModal } from "./modals/BookingModals";
import { InviteAdminModal, MentorEditModal, RosterStudentModal } from "./modals/PeopleModals";
import { BoardTab } from "./tabs/BoardTab";
import { BookingListTab } from "./tabs/BookingListTab";
import { MembersTab } from "./tabs/MembersTab";
import { MentorsTab } from "./tabs/MentorsTab";
import { StudentsTab } from "./tabs/StudentsTab";
import { useAdminData } from "./useAdminData";

const isRuleError = (error) => errorCode(error)?.startsWith("RULE_");

/**
 * Operations dashboard. Region filter and the test-account toggle scope
 * everything below them: KPIs, board, lists.
 */
export function AdminApp({ me, initial }) {
  const { regions, mentors, bookings, students, admins, roster, reload, supabase } = useAdminData(initial);
  const toast = useToast();

  const [regionFilter, setRegionFilter] = useState(ALL_REGIONS);
  const [includeTest, setIncludeTest] = useState(false);
  const [tab, setTab] = useState("board");
  const [moving, setMoving] = useState(null); // booking being moved on the board
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  /* ---------- scope ---------- */

  const regionByName = useMemo(() => new Map(regions.map((r) => [r.name, r])), [regions]);
  const inScope = (group, isTest) => (regionFilter === ALL_REGIONS || group === regionFilter) && (includeTest || !isTest);

  const visibleMentors = mentors
    .filter((m) => inScope(m.region_group, m.is_test))
    .sort((a, b) => regionByName.get(a.region_group).sort_order - regionByName.get(b.region_group).sort_order || a.id - b.id);
  const mentorById = new Map(mentors.map((m) => [m.id, m]));
  const visibleMentorIds = new Set(visibleMentors.map((m) => m.id));
  const visibleBookings = bookings.filter((b) => visibleMentorIds.has(b.mentor_id));
  const visibleRoster = roster.filter((r) => inScope(r.region_group, r.is_test));

  const scopeRegions = regionFilter === ALL_REGIONS ? regions : [regionByName.get(regionFilter)];
  const dates = regionFilter === ALL_REGIONS ? mergeSessionDates(regions) : buildSessionDates(scopeRegions[0].starts_on, scopeRegions[0].ends_on);
  const totalSlots = visibleMentors.reduce((sum, m) => {
    const r = regionByName.get(m.region_group);
    return sum + buildSessionDates(r.starts_on, r.ends_on).length * TIME_SLOTS.length;
  }, 0);
  const bookedStudents = new Set(visibleBookings.map((b) => b.student_id)).size;
  const rosterCount = visibleRoster.filter((r) => r.status !== "legacy").length;

  /* ---------- booking operations (board + list) ---------- */

  async function cancelBooking(booking) {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_booking", { p_booking_id: booking.id });
    setBusy(false);
    setModal(null);
    if (error) return toast(toUserMessage(error), "error");
    if (moving?.id === booking.id) setMoving(null);
    toast("예약을 취소했어요");
    reload("bookings", "roster");
  }

  function startMove(booking) {
    setModal(null);
    setMoving(booking);
    setTab("board");
    const group = mentorById.get(booking.mentor_id)?.region_group;
    if (regionFilter !== ALL_REGIONS && group !== regionFilter) setRegionFilter(group);
    toast("옮길 빈 칸을 눌러주세요", "info");
  }

  /** Moves the booking; on a rule violation, asks before forcing it. */
  async function moveTo(target, force = false) {
    setBusy(true);
    const { error } = await supabase.rpc("move_booking", {
      p_booking_id: moving.id,
      p_mentor_id: target.mentorId,
      p_date: target.date,
      p_time: target.time,
      p_force: force,
    });
    setBusy(false);
    if (error) {
      if (!force && isRuleError(error)) return setModal({ type: "forceMove", target, message: toUserMessage(error) });
      setModal(null);
      toast(toUserMessage(error), "error");
      return reload("bookings");
    }
    setModal(null);
    setMoving(null);
    toast(force ? "규칙과 다르지만 예약을 옮겼어요" : "예약을 옮겼어요");
    reload("bookings");
  }

  /* ---------- render ---------- */

  const closeModal = () => setModal(null);
  const openBooking = (booking) => setModal({ type: "booking", booking });

  return (
    <>
      <TopBar name={me?.name ?? "관리자"} roleLabel={me?.email} context={<ContextChip Icon={ShieldCheck}>관리자</ContextChip>} />
      <PageContainer>
        <PageHero
          title="전체 예약 현황"
          meta={[
            {
              Icon: CalendarDays,
              text: regionFilter === ALL_REGIONS ? `${formatDate(dates[0].date)} ~ ${formatDate(dates.at(-1).date)}` : formatPeriod(scopeRegions[0]),
            },
            { Icon: Users, text: `학생 명단 ${rosterCount}명` },
            { Icon: User, text: `멘토 ${visibleMentors.length}명` },
          ]}
          aside={
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                label="권역 선택"
                value={regionFilter}
                onChange={(value) => {
                  setRegionFilter(value);
                  setMoving(null);
                }}
                options={[ALL_REGIONS, ...regions.map((r) => r.name)].map((v) => ({ value: v, label: v }))}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
                <input type="checkbox" className="size-4 accent-blue-600" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
                테스트 계정 포함
              </label>
            </div>
          }
        />

        <KpiGrid
          items={[
            { label: "전체 예약", value: `${visibleBookings.length}건`, sub: `${regionFilter} 기준`, Icon: CalendarCheck },
            {
              label: "예약률",
              value: `${totalSlots ? Math.round((visibleBookings.length / totalSlots) * 100) : 0}%`,
              sub: `전체 ${totalSlots}칸 중`,
              Icon: CircleCheck,
            },
            { label: "예약한 학생", value: `${bookedStudents}명`, sub: `명단 ${rosterCount}명 중`, Icon: Users },
            { label: "빈 시간", value: `${totalSlots - visibleBookings.length}칸`, sub: "지정 예약 가능", Icon: Clock },
          ]}
        />

        <Tabs
          label="관리 메뉴"
          value={tab}
          onChange={setTab}
          items={[
            { value: "board", label: "예약 보드" },
            { value: "list", label: "예약 목록", count: visibleBookings.length },
            { value: "students", label: "학생", count: visibleRoster.length },
            { value: "mentors", label: "멘토", count: visibleMentors.length },
            { value: "members", label: "멤버", count: admins.length },
          ]}
        />

        {tab === "board" && (
          <BoardTab
            mentors={visibleMentors}
            dates={dates}
            regionByName={regionByName}
            bookings={visibleBookings}
            moving={moving}
            busy={busy}
            showRegion={regionFilter === ALL_REGIONS}
            onOpenBooking={openBooking}
            onAssign={(slot) => setModal({ type: "assign", slot })}
            onMoveTo={(target) => moveTo(target)}
            onCancelMove={() => setMoving(null)}
          />
        )}
        {tab === "list" && (
          <BookingListTab
            bookings={visibleBookings}
            mentorById={mentorById}
            onMove={startMove}
            onCancel={(booking) => setModal({ type: "cancel", booking })}
          />
        )}
        {tab === "students" && (
          <StudentsTab
            roster={visibleRoster}
            onAdd={() => setModal({ type: "rosterStudent", row: null })}
            onEdit={(row) => setModal({ type: "rosterStudent", row })}
          />
        )}
        {tab === "mentors" && (
          <MentorsTab mentors={visibleMentors} onEdit={(mentor) => setModal({ type: "mentor", mentor })} onChanged={() => reload("mentors")} />
        )}
        {tab === "members" && (
          <MembersTab
            admins={admins}
            me={me}
            onInvite={() => setModal({ type: "inviteAdmin" })}
            onRevoke={(member) => setModal({ type: "revoke", member })}
            onChanged={() => reload("admins")}
          />
        )}
      </PageContainer>

      {/* ---------- modals ---------- */}

      {modal?.type === "booking" && (
        <BookingDetailModal
          booking={modal.booking}
          mentor={mentorById.get(modal.booking.mentor_id)}
          onMove={() => startMove(modal.booking)}
          onCancel={() => setModal({ type: "cancel", booking: modal.booking })}
          onLogged={(status) => {
            setModal({ type: "booking", booking: { ...modal.booking, session_status: status } });
            reload("bookings");
          }}
          onClose={closeModal}
        />
      )}

      {modal?.type === "cancel" && (
        <ConfirmModal
          title="예약을 취소할까요?"
          description="취소하면 그 시간은 다시 예약 가능해져요. 기록은 남아요."
          confirmLabel="예약 취소"
          busy={busy}
          onConfirm={() => cancelBooking(modal.booking)}
          onClose={closeModal}
        >
          <SlotSummary
            date={modal.booking.booking_date}
            time={modal.booking.booking_time}
            mentorLabel={mentorById.get(modal.booking.mentor_id)?.name ?? ""}
          />
          <p className="mt-2 text-[13px] text-zinc-600">
            학생: {modal.booking.students?.name} · <span className="tnum">{modal.booking.students?.phone}</span>
          </p>
        </ConfirmModal>
      )}

      {modal?.type === "forceMove" && (
        <ConfirmModal
          title="규칙과 다른 시간이에요"
          description="운영진은 규칙과 달라도 옮길 수 있어요."
          confirmLabel="그래도 옮기기"
          keepLabel="취소"
          busy={busy}
          onConfirm={() => moveTo(modal.target, true)}
          onClose={closeModal}
        >
          <Alert tone="error">{modal.message}</Alert>
        </ConfirmModal>
      )}

      {modal?.type === "assign" && (
        <AssignBookingModal
          slot={modal.slot}
          mentor={mentorById.get(modal.slot.mentorId)}
          students={students}
          onDone={(forced) => {
            closeModal();
            toast(forced ? "규칙과 다르지만 예약했어요" : "학생을 예약했어요");
            reload("bookings", "roster");
          }}
          onClose={closeModal}
        />
      )}

      {modal?.type === "mentor" && (
        <MentorEditModal
          mentor={modal.mentor}
          onSaved={() => {
            closeModal();
            toast(`${modal.mentor.name} 멘토 정보를 저장했어요`);
            reload("mentors");
          }}
          onClose={closeModal}
        />
      )}

      {modal?.type === "rosterStudent" && (
        <RosterStudentModal
          row={modal.row}
          regions={regions}
          onSaved={() => {
            closeModal();
            toast("학생 명단을 저장했어요");
            reload("roster");
          }}
          onClose={closeModal}
        />
      )}

      {modal?.type === "inviteAdmin" && (
        <InviteAdminModal
          onDone={(email) => {
            closeModal();
            toast(`${email} 으로 초대 메일을 보냈어요`);
            reload("admins");
          }}
          onClose={closeModal}
        />
      )}

      {modal?.type === "revoke" && (
        <ConfirmModal
          title="관리자 권한을 해제할까요?"
          description={`${modal.member.name} (${modal.member.email}) 님은 더 이상 관리자 화면에 들어올 수 없어요.`}
          confirmLabel="권한 해제"
          busy={busy}
          onConfirm={async () => {
            setBusy(true);
            const { error } = await supabase.rpc("admin_revoke", { p_email: modal.member.email });
            setBusy(false);
            closeModal();
            if (error) return toast(toUserMessage(error), "error");
            toast(`${modal.member.name}님의 관리자 권한을 해제했어요`);
            reload("admins");
          }}
          onClose={closeModal}
        />
      )}
    </>
  );
}
