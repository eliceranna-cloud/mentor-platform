"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

// 권역별로 보여줄 세부 지역 3개
const REGION_GROUPS = {
  충청권: ["충남", "충북", "세종"],
  동남권: ["부산", "울산", "경남"],
};

// 화면(카드)에 쓸 스타일 톤 — 권역마다 다른 색감
const GROUP_THEME = {
  충청권: {
    bg: "bg-blue-50",
    bgHover: "hover:bg-blue-100",
    text: "text-blue-900",
    sub: "text-blue-600",
    chipActive: "bg-blue-600 text-white border-blue-600",
  },
  동남권: {
    bg: "bg-emerald-50",
    bgHover: "hover:bg-emerald-100",
    text: "text-emerald-900",
    sub: "text-emerald-600",
    chipActive: "bg-emerald-600 text-white border-emerald-600",
  },
};

const TIME_SLOTS = ["19:00", "19:30", "20:00", "20:30"];
const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
const STORAGE_KEY = "mentorPlatformLogin";

// 권역별 실제 멘토링 진행 기간 (평일만 진행)
const REGION_SCHEDULE = {
  동남권: { start: "2026-10-12", end: "2026-10-23" }, // 10/12(월)~10/23(금), 10일간
  충청권: { start: "2026-10-13", end: "2026-10-30" }, // 10/13(화)~10/30(금), 14일간
};

// 시작일~종료일 사이의 평일(월~금) 목록 생성
function buildDateRange(startStr, endStr) {
  const list = [];
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) continue; // 주말 제외
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${dd}`;
    list.push({
      dateStr,
      monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: WEEKDAY_LABEL[day],
      isToday: dateStr === todayStr,
    });
  }
  return list;
}

function sameSlot(a, b) {
  return a.mentorId === b.mentorId && a.date === b.date && a.time === b.time;
}

export default function Home() {
  const [step, setStep] = useState(0); // 0:확인중 1:권역 2:지역/이름/전화 3:메인 4:시간선택 5:예약완료 6:내예약(마이페이지)
  const [form, setForm] = useState({ group: "", region: "", name: "", phone: "" });
  const [studentId, setStudentId] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [dateList, setDateList] = useState([]);
  const [selectedMentorId, setSelectedMentorId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [myBookings, setMyBookings] = useState([]); // 이 학생의 확정된 예약 (전체 멘토 대상)
  const [pendingSlots, setPendingSlots] = useState([]); // 아직 "예약 완료" 누르기 전, 선택만 된 슬롯
  const [justBooked, setJustBooked] = useState([]); // 방금 확정한 예약 (완료 화면에 보여줄 목록)
  const [mentorBookings, setMentorBookings] = useState([]); // 지금 보고 있는 멘토의 전체 예약 현황(다른 학생 포함)
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 저장된 로그인 정보 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.studentId) {
          setForm(parsed);
          setStudentId(parsed.studentId);
          setStep(3);
          return;
        }
      }
    } catch (e) {}
    setStep(1);
  }, []);

  // 권역이 정해지면: 해당 권역 멘토 목록 + 실제 멘토링 날짜 목록 불러오기
  useEffect(() => {
    if (!form.group) return;
    const schedule = REGION_SCHEDULE[form.group];
    setDateList(buildDateRange(schedule.start, schedule.end));
    setMentorsLoading(true);
    supabase
      .from("mentors")
      .select("*")
      .eq("region_group", form.group)
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setMentors(data);
        setMentorsLoading(false);
      });
  }, [form.group]);

  // 로그인된 학생의 확정 예약(전체 멘토) 새로고침
  const refreshMyBookings = useCallback((sid) => {
    if (!sid) return;
    supabase
      .from("bookings")
      .select("id, mentor_id, booking_date, booking_time")
      .eq("student_id", sid)
      .then(({ data, error }) => {
        if (!error && data) {
          setMyBookings(
            data.map((b) => ({
              id: b.id,
              mentorId: b.mentor_id,
              date: b.booking_date,
              time: b.booking_time,
            }))
          );
        }
      });
  }, []);

  useEffect(() => {
    if (studentId) refreshMyBookings(studentId);
  }, [studentId, refreshMyBookings]);

  // 예약 화면(4단계)에 들어가면: 그 멘토의 전체 예약 현황 불러오기 + 실시간 구독
  useEffect(() => {
    if (step !== 4 || !selectedMentorId) return;
    let active = true;

    function load() {
      supabase
        .from("bookings")
        .select("id, student_id, booking_date, booking_time")
        .eq("mentor_id", selectedMentorId)
        .then(({ data, error }) => {
          if (active && !error && data) setMentorBookings(data);
        });
    }
    load();

    const channel = supabase
      .channel(`bookings-mentor-${selectedMentorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `mentor_id=eq.${selectedMentorId}` },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [step, selectedMentorId]);

  function handleGroupSelect(group) {
    setForm((f) => ({ ...f, group, region: "" }));
    setStep(2);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("students")
      .upsert(
        { name: form.name, phone: form.phone, region_group: form.group, region: form.region },
        { onConflict: "phone" }
      )
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      setErrorMsg("저장 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    const nextForm = { ...form, studentId: data.id };
    setForm(nextForm);
    setStudentId(data.id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextForm));
    } catch (e) {}
    setStep(3);
  }

  function handleLogout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setForm({ group: "", region: "", name: "", phone: "" });
    setStudentId(null);
    setMentors([]);
    setMyBookings([]);
    setPendingSlots([]);
    setStep(1);
  }

  function openBooking(mentorId) {
    setSelectedMentorId(mentorId);
    setSelectedDate(dateList[0]?.dateStr ?? null);
    setPendingSlots([]);
    setErrorMsg("");
    setStep(4);
  }

  // 특정 날짜에 내가 확정+선택중인 시간들의 TIME_SLOTS 인덱스 목록
  function myIndicesOnDate(date) {
    const confirmed = myBookings.filter((b) => b.date === date).map((b) => TIME_SLOTS.indexOf(b.time));
    const pending = pendingSlots.filter((b) => b.date === date).map((b) => TIME_SLOTS.indexOf(b.time));
    return [...confirmed, ...pending];
  }

  // 지금 보는 멘토의 특정 날짜/시간이 "다른 학생"에 의해 이미 잠겼는지
  function isTakenByOther(date, time) {
    return mentorBookings.some(
      (b) => b.booking_date === date && b.booking_time === time && b.student_id !== studentId
    );
  }

  // 슬롯 클릭: 예약가능→선택, 선택됨→선택취소, 확정됨→바로취소
  function handleSlotClick(mentorId, date, time) {
    const slot = { mentorId, date, time };
    if (isTakenByOther(date, time)) return;

    const confirmedSlot = myBookings.find((b) => sameSlot(b, slot));
    if (confirmedSlot) {
      cancelBooking(confirmedSlot);
      return;
    }
    const isPending = pendingSlots.some((b) => sameSlot(b, slot));
    if (isPending) {
      setPendingSlots((list) => list.filter((b) => !sameSlot(b, slot)));
      return;
    }
    const indices = myIndicesOnDate(date);
    if (indices.length >= 2) return; // 하루 최대 2개
    if (indices.length === 1) {
      const newIndex = TIME_SLOTS.indexOf(time);
      if (Math.abs(newIndex - indices[0]) !== 1) return; // 연속된 슬롯만 허용
    }
    setPendingSlots((list) => [...list, slot]);
  }

  async function confirmBooking() {
    if (pendingSlots.length === 0 || !studentId) return;
    setSaving(true);
    setErrorMsg("");
    const rows = pendingSlots.map((s) => ({
      student_id: studentId,
      mentor_id: s.mentorId,
      booking_date: s.date,
      booking_time: s.time,
    }));
    const { error } = await supabase.from("bookings").insert(rows);
    setSaving(false);
    if (error) {
      setErrorMsg("앗, 방금 다른 학생이 먼저 예약한 시간이 있는 것 같아요. 아래 시간표를 다시 확인해주세요.");
      supabase
        .from("bookings")
        .select("id, student_id, booking_date, booking_time")
        .eq("mentor_id", selectedMentorId)
        .then(({ data }) => data && setMentorBookings(data));
      return;
    }
    setJustBooked(pendingSlots);
    setPendingSlots([]);
    refreshMyBookings(studentId);
    setStep(5);
  }

  async function cancelBooking(slot) {
    if (!slot?.id) return;
    await supabase.from("bookings").delete().eq("id", slot.id);
    refreshMyBookings(studentId);
  }

  function cancelPending(slot) {
    setPendingSlots((list) => list.filter((b) => !sameSlot(b, slot)));
  }

  if (step === 0) {
    return <div className="min-h-full bg-zinc-50" />;
  }

  // 1단계 — 권역 선택: 화면을 좌우로 크게 나눠서 직관적으로
  if (step === 1) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="border-b border-zinc-200 bg-white px-6 py-7 text-center">
          <p className="text-sm font-medium text-zinc-400">결제 없는 무료 멘토링</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">멘토-멘티 실시간 예약</h1>
          <p className="mt-2 text-zinc-500">먼저, 어느 권역이신가요?</p>
        </div>

        <div className="flex flex-1 flex-col sm:flex-row">
          {Object.keys(REGION_GROUPS).map((group) => {
            const theme = GROUP_THEME[group];
            return (
              <button
                key={group}
                type="button"
                onClick={() => handleGroupSelect(group)}
                className={`group flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 transition ${theme.bg} ${theme.bgHover}`}
              >
                <span className={`flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl font-bold shadow-sm transition group-hover:scale-105 ${theme.text}`}>
                  {group.charAt(0)}
                </span>
                <h2 className={`text-3xl font-extrabold tracking-tight ${theme.text}`}>{group}</h2>
                <p className={`text-base ${theme.sub}`}>{REGION_GROUPS[group].join(" · ")}</p>
                <span className={`mt-2 rounded-full border border-current px-4 py-1.5 text-sm font-medium opacity-0 transition group-hover:opacity-100 ${theme.text}`}>
                  선택하기 →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 2단계 — 세부 지역 선택 + 이름/전화번호를 한 화면에서
  if (step === 2) {
    const theme = GROUP_THEME[form.group];
    const canSubmit = form.region && form.name.trim() && form.phone.trim() && !saving;
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 px-6 py-16">
        <div className="w-full max-w-md">
          <button type="button" onClick={() => setStep(1)} className="mb-4 text-sm text-zinc-400 hover:text-zinc-600">
            ← 권역 다시 선택
          </button>

          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${theme.bg} ${theme.text}`}>
            {form.group}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900">조금만 더 알려주세요</h1>
          <p className="mt-1 text-sm text-zinc-500">지역과 이름, 전화번호를 입력하면 바로 시작할 수 있어요.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700">지역</span>
              <div className="grid grid-cols-3 gap-2">
                {REGION_GROUPS[form.group].map((region) => {
                  const active = form.region === region;
                  return (
                    <button
                      key={region}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, region }))}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                        active ? theme.chipActive : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                      }`}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-sm font-medium text-zinc-700">이름</span>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-sm font-medium text-zinc-700">전화번호</span>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="010-1234-5678"
                pattern="[0-9\-]{9,13}"
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>

            {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {saving ? "저장 중..." : "시작하기"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3단계 — 메인 화면 (선택한 권역의 멘토만)
  if (step === 3) {
    return (
      <div className="min-h-full bg-zinc-50">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="text-sm font-medium text-blue-600">결제 없는 무료 멘토링</p>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">멘토-멘티 실시간 예약</h1>
            <p className="text-zinc-500">
              {form.name}님, 반가워요! ({form.group} · {form.region})
            </p>
            <div className="mt-2 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setStep(6)}
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                내 예약 확인하기
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
              >
                다른 정보로 다시 시작하기
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-12">
          {mentorsLoading ? (
            <p className="text-center text-sm text-zinc-400">멘토 목록을 불러오는 중...</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mentors.map((mentor) => (
                <div key={mentor.id} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
                    {mentor.name.charAt(0)}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-zinc-900">{mentor.name}</h2>
                  <p className="mt-1 text-sm font-medium text-blue-600">{mentor.field}</p>
                  <p className="mt-3 flex-1 text-sm leading-6 text-zinc-500">{mentor.intro}</p>
                  <button
                    type="button"
                    onClick={() => openBooking(mentor.id)}
                    className="mt-5 w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    예약 가능 시간 보기
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // 4단계 — 시간 슬롯 선택 + 예약 완료 버튼
  if (step === 4) {
    const mentor = mentors.find((m) => m.id === selectedMentorId);
    const dateIndices = selectedDate ? myIndicesOnDate(selectedDate) : [];
    const pendingCount = pendingSlots.length;

    return (
      <div className="min-h-full bg-zinc-50 pb-40">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <button type="button" onClick={() => setStep(3)} className="text-sm text-zinc-400 hover:text-zinc-600">
              ← 멘토 목록으로
            </button>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
                {mentor?.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900">{mentor?.name}</h1>
                <p className="text-sm text-blue-600">{mentor?.field}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-8">
          {/* 날짜 선택 */}
          <p className="text-sm font-medium text-zinc-700">날짜 선택</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {dateList.map((d) => {
              const active = d.dateStr === selectedDate;
              const dCount = myIndicesOnDate(d.dateStr).length;
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`relative flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2.5 text-sm transition ${
                    active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {dCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {dCount}
                    </span>
                  )}
                  <span className="font-semibold">{d.monthDay}</span>
                  <span className="text-xs opacity-80">{d.isToday ? "오늘" : d.weekday}</span>
                </button>
              );
            })}
          </div>

          {/* 시간 슬롯 */}
          <p className="mt-8 text-sm font-medium text-zinc-700">
            시간 선택 <span className="text-zinc-400">(저녁 19:00~21:00, 30분 단위 · 2개를 고르면 연속된 시간이어야 해요)</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIME_SLOTS.map((time, timeIndex) => {
              const slot = { mentorId: selectedMentorId, date: selectedDate, time };
              const takenByOther = selectedDate ? isTakenByOther(selectedDate, time) : false;
              const confirmed = myBookings.some((b) => sameSlot(b, slot));
              const pending = pendingSlots.some((b) => sameSlot(b, slot));
              const mine = confirmed || pending;

              const disabledByLimit = !mine && !takenByOther && dateIndices.length >= 2;
              const disabledByConsecutive =
                !mine &&
                !takenByOther &&
                !disabledByLimit &&
                dateIndices.length === 1 &&
                Math.abs(timeIndex - dateIndices[0]) !== 1;

              let stateClass = "border-zinc-200 bg-white text-zinc-700 hover:border-blue-400";
              let label = "예약 가능";
              if (takenByOther) {
                stateClass = "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed";
                label = "마감";
              } else if (confirmed) {
                stateClass = "border-blue-600 bg-blue-600 text-white";
                label = "예약됨 · 취소";
              } else if (pending) {
                stateClass = "border-amber-500 bg-amber-50 text-amber-700";
                label = "선택됨";
              } else if (disabledByLimit) {
                stateClass = "border-zinc-200 bg-white text-zinc-300 cursor-not-allowed";
                label = "하루 2개 마감";
              } else if (disabledByConsecutive) {
                stateClass = "border-zinc-200 bg-white text-zinc-300 cursor-not-allowed";
                label = "연속만 가능";
              }

              return (
                <button
                  key={time}
                  type="button"
                  disabled={takenByOther || disabledByLimit || disabledByConsecutive}
                  onClick={() => handleSlotClick(selectedMentorId, selectedDate, time)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-4 transition ${stateClass}`}
                >
                  <span className="text-base font-semibold">{time}</span>
                  <span className="text-xs">{label}</span>
                </button>
              );
            })}
          </div>

          {errorMsg && <p className="mt-4 text-sm text-red-500">{errorMsg}</p>}

          {/* 내 확정 예약 요약 (날짜 무관, 전체) */}
          {myBookings.length > 0 && (
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm font-semibold text-zinc-900">내 예약 현황 (확정)</p>
              <ul className="mt-3 flex flex-col gap-2">
                {myBookings.map((b) => {
                  const m = mentors.find((mm) => mm.id === b.mentorId);
                  const d = dateList.find((dd) => dd.dateStr === b.date);
                  return (
                    <li key={b.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700">
                        {d?.monthDay ?? b.date}({d?.isToday ? "오늘" : d?.weekday ?? ""}) · {b.time} · {m?.name ?? ""}
                      </span>
                      <button type="button" onClick={() => cancelBooking(b)} className="text-xs text-red-500 hover:underline">
                        취소
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </main>

        {/* 하단 고정 바 — 선택된(아직 미확정) 슬롯을 날짜와 상관없이 목록으로 항상 보여줌 */}
        {pendingCount > 0 && (
          <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-wrap gap-2">
                {pendingSlots.map((b, i) => {
                  const d = dateList.find((dd) => dd.dateStr === b.date);
                  return (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                    >
                      {d?.monthDay}({d?.isToday ? "오늘" : d?.weekday}) {b.time}
                      <button
                        type="button"
                        onClick={() => cancelPending(b)}
                        className="text-amber-400 hover:text-amber-700"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-sm text-zinc-600">
                  총 <span className="font-semibold text-amber-600">{pendingCount}개</span> 선택됨
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={confirmBooking}
                  className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {saving ? "예약 중..." : "예약 완료"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5단계 — 예약 완료 화면
  if (step === 5) {
    const mentor = mentors.find((m) => m.id === selectedMentorId);
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl text-blue-600">
            ✓
          </div>
          <h1 className="mt-5 text-2xl font-bold text-zinc-900">예약이 완료됐어요!</h1>
          <p className="mt-2 text-sm text-zinc-500">
            예약 시간이 되면 "내 예약 확인하기"에서 입장 링크를 눌러 들어오시면 돼요.
          </p>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 text-left">
            <p className="text-sm font-semibold text-zinc-900">{mentor?.name}</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {justBooked.map((b, i) => {
                const d = dateList.find((dd) => dd.dateStr === b.date);
                return (
                  <li key={i} className="text-sm text-zinc-600">
                    {d?.monthDay}({d?.isToday ? "오늘" : d?.weekday}) · {b.time}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 rounded-full border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400"
            >
              이 멘토 더 예약하기
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              메인으로 돌아가기
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStep(6)}
            className="mt-4 w-full text-sm text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            내 예약 전체 보기
          </button>
        </div>
      </div>
    );
  }

  // 6단계 — 내 예약 확인 (마이페이지): 예약 내역 + 시간 되면 누를 입장 링크
  if (step === 6) {
    const sortedBookings = [...myBookings].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return TIME_SLOTS.indexOf(a.time) - TIME_SLOTS.indexOf(b.time);
    });

    return (
      <div className="min-h-full bg-zinc-50 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <button type="button" onClick={() => setStep(3)} className="text-sm text-zinc-400 hover:text-zinc-600">
            ← 메인으로
          </button>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900">내 예약 확인</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {form.name}님이 예약하신 시간이에요. 예약 시간이 되면 입장 링크를 눌러 들어오세요.
          </p>

          {sortedBookings.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-400">
              아직 예약한 내역이 없어요.
            </div>
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {sortedBookings.map((b) => {
                const m = mentors.find((mm) => mm.id === b.mentorId);
                const d = dateList.find((dd) => dd.dateStr === b.date);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{m?.name ?? "멘토"}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {d?.monthDay ?? b.date}({d?.isToday ? "오늘" : d?.weekday ?? ""}) · {b.time}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m?.meeting_link ? (
                        <a
                          href={m.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
                        >
                          입장하기
                        </a>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-400">
                          링크 준비중
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => cancelBooking(b)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        취소
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return null;
}
