"use client";

import { Pencil, Phone, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Toolbar } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Chip, RegionChip, TestChip } from "@/components/ui/Chip";
import { EmptyState, Hint } from "@/components/ui/Display";
import { SearchInput } from "@/components/ui/SearchInput";
import { STUDENT_STATUS } from "@/lib/admin/status";
import { phoneDigits } from "@/lib/validation";

/**
 * The LXP roster with each student's sign-up status. Also lists old records
 * from the previous phone-number screen that no account has claimed yet.
 */
export function StudentsTab({ roster, onAdd, onEdit }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = phoneDigits(q);
    if (!q) return roster;
    return roster.filter(
      (r) => r.name?.toLowerCase().includes(q) || r.email?.includes(q) || (digits && phoneDigits(r.phone).includes(digits))
    );
  }, [roster, query]);

  return (
    <section aria-label="학생">
      <Hint>
        명단에 있는 이메일로만 학생 가입이 돼요. 가입이 막힌 학생이 문의하면 여기서 명단에 추가해주세요.
      </Hint>
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="이름, 이메일, 전화번호로 찾기" />
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">{rows.length}명</span>
          <Button size="sm" onClick={onAdd}>
            <Plus className="size-4" aria-hidden />
            명단에 추가
          </Button>
        </div>
      </Toolbar>
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const status = STUDENT_STATUS[r.status];
            return (
              <li key={r.email ?? `legacy-${r.student_id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                    {r.name}
                    <RegionChip group={r.region_group} area={r.region} />
                    {r.is_test && <TestChip />}
                    <PhoneFlags row={r} />
                  </p>
                  {/* Each piece is its own element: conditional parts next to bare text
                      break React updates when the browser translates the page. */}
                  <p className="text-sm break-all text-zinc-600">
                    <span>{r.email ?? "이메일 없음"}</span>
                    {r.phone && <span className="tnum"> · {r.phone}</span>}
                    <span> · 예약 {r.booking_count}건</span>
                  </p>
                  {r.phone_differs && (
                    <p className="mt-1 text-[13px] text-amber-700">
                      <span>LXP 명단 번호: </span>
                      <span className="tnum">{r.roster_phone}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={status.tone}>{status.label}</Chip>
                  {r.status === "not_signed_up" && (
                    <Button variant="ghost" size="sm" onClick={() => onEdit(r)} aria-label={`${r.name} 명단 정보 수정`}>
                      <Pencil className="size-4" aria-hidden />
                      수정
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState Icon={Search} message="조건에 맞는 학생이 없어요." />
      )}
    </section>
  );
}

/**
 * Sign-up accepts any valid phone; these chips tell admins when to double-check
 * it: it is not the number in the LXP roster, or another record uses it too.
 */
function PhoneFlags({ row }) {
  return (
    <>
      {row.phone_differs && (
        <Chip tone="warn">
          <Phone className="size-3.5" aria-hidden />
          <span>LXP 번호와 다름</span>
        </Chip>
      )}
      {row.phone_shared && (
        <Chip tone="warn">
          <Phone className="size-3.5" aria-hidden />
          <span>같은 번호 있음</span>
        </Chip>
      )}
    </>
  );
}
