"use client";

import { ArrowLeftRight } from "lucide-react";
import { useMemo, useState } from "react";
import { SlotSummary } from "@/components/booking/Modals";
import { SessionStatusPicker } from "@/components/booking/SessionStatusPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SummaryList } from "@/components/ui/Display";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { isSlotPast } from "@/lib/booking/dates";
import { errorCode, toUserMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Booking + student details, with move and cancel. Once the session has
 * started, admins can also record (or correct) its outcome.
 */
export function BookingDetailModal({ booking, mentor, onMove, onCancel, onLogged, onClose }) {
  const student = booking.students ?? {};
  const started = isSlotPast(booking.booking_date, booking.booking_time);
  return (
    <Modal
      title="예약 상세"
      description="운영진은 예약을 옮기거나 취소할 수 있어요."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onMove}>
            <ArrowLeftRight className="size-4" aria-hidden />
            시간 이동
          </Button>
          <Button variant="danger" onClick={onCancel}>
            예약 취소
          </Button>
        </>
      }
    >
      <SlotSummary date={booking.booking_date} time={booking.booking_time} mentorLabel={`${mentor?.name} · ${mentor?.region_group}`} />
      <SummaryList
        className="mt-2"
        rows={[
          ["학생", student.name ?? "-"],
          ["전화번호", student.phone ? <a href={`tel:${student.phone}`}>{student.phone}</a> : "-"],
          ["이메일", student.email ?? "가입 전 기록"],
          ["권역 · 지역", `${student.region_group ?? ""} ${student.region ?? ""}`],
        ]}
      />
      {started && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">세션 기록</p>
          <SessionStatusPicker bookingId={booking.id} status={booking.session_status} onSaved={onLogged} />
        </div>
      )}
    </Modal>
  );
}

/**
 * Book a named student into an empty slot. Only students who have an account
 * (or an old record) in the mentor's region can be picked. If the booking
 * breaks the per-day rules, the admin sees why and may book it anyway.
 */
export function AssignBookingModal({ slot, mentor, students, onDone, onClose }) {
  const supabase = getSupabaseBrowserClient();
  const pool = useMemo(
    () => students.filter((s) => s.region_group === mentor.region_group && s.is_test === mentor.is_test),
    [students, mentor]
  );
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState(null);
  const [ruleBroken, setRuleBroken] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = query.trim() ? pool.filter((s) => s.name.includes(query.trim()) || s.phone?.includes(query.trim())) : pool;

  async function submit(force) {
    if (!studentId) return setError("예약할 학생을 골라주세요.");
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("admin_create_booking", {
      p_student_id: Number(studentId),
      p_mentor_id: mentor.id,
      p_date: slot.date,
      p_time: slot.time,
      p_force: force,
    });
    setBusy(false);
    if (!rpcError) return onDone(force);

    const isRule = errorCode(rpcError)?.startsWith("RULE_");
    setRuleBroken(isRule && !force);
    const student = pool.find((s) => String(s.id) === studentId);
    setError(isRule ? `${student?.name} 학생은 이 시간을 예약할 수 없어요. ${toUserMessage(rpcError)}` : toUserMessage(rpcError));
  }

  return (
    <Modal
      title="학생 지정 예약"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          {ruleBroken ? (
            <Button variant="danger" loading={busy} onClick={() => submit(true)}>
              규칙 무시하고 예약
            </Button>
          ) : (
            <Button loading={busy} disabled={!pool.length} onClick={() => submit(false)}>
              예약 추가
            </Button>
          )}
        </>
      }
    >
      <SlotSummary date={slot.date} time={slot.time} mentorLabel={`${mentor.name} · ${mentor.region_group}`} className="mb-4" />
      {pool.length ? (
        <div className="flex flex-col gap-4">
          <Field label="학생 찾기">
            {(id, aria) => <Input id={id} {...aria} type="search" placeholder="이름 또는 전화번호" value={query} onChange={(e) => setQuery(e.target.value)} />}
          </Field>
          <Field label="학생" hint={`${mentor.region_group}에 가입한 학생만 고를 수 있어요.`}>
            {(id, aria) => (
              <Select
                id={id}
                {...aria}
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setRuleBroken(false);
                  setError(null);
                }}
              >
                <option value="">학생을 골라주세요 ({filtered.length}명)</option>
                {filtered.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.region} · {s.phone}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      ) : (
        <Alert tone="info">{mentor.region_group}에 가입한 학생이 아직 없어요. 학생이 가입하면 여기서 지정 예약할 수 있어요.</Alert>
      )}
    </Modal>
  );
}
