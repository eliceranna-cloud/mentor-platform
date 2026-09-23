"use client";

import { ArrowLeftRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BookingRow } from "@/components/booking/BookingRow";
import { SessionStatusChip } from "@/components/booking/SessionStatusPicker";
import { Toolbar } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { RegionChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Display";
import { SearchInput } from "@/components/ui/SearchInput";
import { bySlot } from "@/lib/booking/dates";
import { phoneDigits } from "@/lib/validation";

/** Searchable list of every active booking. */
export function BookingListTab({ bookings, mentorById, onMove, onCancel }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim();
    const digits = phoneDigits(q);
    return bookings
      .filter((b) => {
        if (!q) return true;
        const student = b.students ?? {};
        return (
          student.name?.includes(q) ||
          (digits && phoneDigits(student.phone).includes(digits)) ||
          mentorById.get(b.mentor_id)?.name.includes(q)
        );
      })
      .sort(bySlot);
  }, [bookings, mentorById, query]);

  return (
    <section aria-label="예약 목록">
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="학생 이름, 전화번호, 멘토 이름으로 찾기" />
        <span className="text-sm text-zinc-600">{rows.length}건</span>
      </Toolbar>
      {rows.length ? (
        <div className="flex flex-col gap-2">
          {rows.map((b) => {
            const mentor = mentorById.get(b.mentor_id);
            return (
              <BookingRow
                key={b.id}
                date={b.booking_date}
                time={b.booking_time}
                title={`· ${mentor?.name} 멘토`}
                subtitle={
                  <span className="flex flex-wrap items-center gap-2">
                    <RegionChip group={mentor?.region_group} />
                    <SessionStatusChip status={b.session_status} />
                    <span>
                      {b.students?.name} · <span className="tnum">{b.students?.phone}</span>
                    </span>
                  </span>
                }
                actions={
                  <>
                    <Button variant="outline" size="sm" onClick={() => onMove(b)}>
                      <ArrowLeftRight className="size-4" aria-hidden />
                      이동
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onCancel(b)}>
                      취소
                    </Button>
                  </>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState Icon={Search} message={query ? "조건에 맞는 예약이 없어요." : "아직 예약이 없어요."} />
      )}
    </section>
  );
}
