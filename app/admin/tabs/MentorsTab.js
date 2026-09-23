"use client";

import { Mail, Pencil, Video } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, RegionChip, TestChip } from "@/components/ui/Chip";
import { Hint } from "@/components/ui/Display";
import { useToast } from "@/components/ui/Toast";
import { inviteActionLabel, inviteStatus } from "@/lib/admin/status";
import { toUserMessage } from "@/lib/errors";
import { sendMentorInvite } from "../actions";

/**
 * Mentor records. Admins fill in email and classroom link, then send the
 * invitation when ready; the mentor only sets a password.
 */
export function MentorsTab({ mentors, onEdit, onChanged }) {
  const toast = useToast();
  const [sendingId, setSendingId] = useState(null);

  async function invite(mentor) {
    setSendingId(mentor.id);
    try {
      const result = await sendMentorInvite({ mentorId: mentor.id });
      if (!result.ok) return toast(result.error, "error");
      toast(
        result.kind === "reset"
          ? `${mentor.name} 멘토에게 비밀번호 설정 메일을 보냈어요`
          : `${mentor.name} 멘토에게 초대 메일을 보냈어요 (${mentor.email})`
      );
      onChanged();
    } catch (error) {
      toast(toUserMessage(error), "error");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <section aria-label="멘토">
      <Hint>멘토는 공개 가입이 없어요. 이메일과 라이브 강의실 링크를 등록한 뒤 초대 메일을 보내면, 멘토는 비밀번호만 정하면 돼요. 전화번호는 운영진만 볼 수 있어요.</Hint>
      <ul className="flex flex-col gap-2">
        {mentors.map((m) => {
          const status = inviteStatus(m);
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                  {m.name}
                  <RegionChip group={m.region_group} />
                  <Chip tone={status.tone}>{status.label}</Chip>
                  {m.is_test && <TestChip />}
                </p>
                {/* Separate elements so browser translation cannot break updates. */}
                <p className="text-sm break-all text-zinc-600">
                  <span>{m.field}</span>
                  {m.email && <span> · {m.email}</span>}
                  {m.phone && <span className="tnum"> · {m.phone}</span>}
                </p>
                <p className="mt-1 flex items-start gap-1 text-[13px] break-all text-zinc-600">
                  <Video className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {m.meeting_link ?? "라이브 강의실 링크 없음"}
                </p>
              </div>
              <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => onEdit(m)}>
                  <Pencil className="size-4" aria-hidden />
                  정보 수정
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!m.email}
                  title={m.email ? undefined : "이메일을 먼저 등록해주세요"}
                  loading={sendingId === m.id}
                  onClick={() => invite(m)}
                >
                  <Mail className="size-4" aria-hidden />
                  {inviteActionLabel(m)}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
