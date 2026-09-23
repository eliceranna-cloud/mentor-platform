"use client";

import { Mail, Plus } from "lucide-react";
import { useState } from "react";
import { Toolbar } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Chip, TestChip } from "@/components/ui/Chip";
import { Hint } from "@/components/ui/Display";
import { useToast } from "@/components/ui/Toast";
import { inviteActionLabel, inviteStatus } from "@/lib/admin/status";
import { toUserMessage } from "@/lib/errors";
import { resendAdminInvite } from "../actions";

/** Operations team. The owner cannot be revoked; nobody can revoke themselves. */
export function MembersTab({ admins, me, onInvite, onRevoke, onChanged }) {
  const toast = useToast();
  const [sendingEmail, setSendingEmail] = useState(null);

  async function resend(member) {
    setSendingEmail(member.email);
    try {
      const result = await resendAdminInvite({ email: member.email });
      if (!result.ok) return toast(result.error, "error");
      toast(`${member.email} 으로 메일을 보냈어요`);
      onChanged();
    } catch (error) {
      toast(toUserMessage(error), "error");
    } finally {
      setSendingEmail(null);
    }
  }

  return (
    <section aria-label="멤버">
      <Hint>관리자는 공개 가입이 없어요. 초대한 사람만 초대 메일에서 비밀번호를 정하고 들어올 수 있어요.</Hint>
      <Toolbar>
        <span className="text-sm text-zinc-600">{admins.length}명</span>
        <Button size="sm" onClick={onInvite}>
          <Plus className="size-4" aria-hidden />
          멤버 초대
        </Button>
      </Toolbar>
      <ul className="flex flex-col gap-2">
        {admins.map((a) => {
          const status = inviteStatus(a);
          const isMe = a.email === me?.email;
          return (
            <li key={a.email} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                  {a.name}
                  <Chip tone={a.is_owner ? "cc" : "neutral"}>{a.is_owner ? "소유자" : "관리자"}</Chip>
                  <Chip tone={status.tone}>{status.label}</Chip>
                  {a.is_test && <TestChip />}
                  {isMe && <span className="text-xs font-medium text-zinc-400">(나)</span>}
                </p>
                <p className="text-sm break-all text-zinc-600">{a.email}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!a.activated_at && (
                  <Button variant="outline" size="sm" loading={sendingEmail === a.email} onClick={() => resend(a)}>
                    <Mail className="size-4" aria-hidden />
                    {inviteActionLabel(a)}
                  </Button>
                )}
                {a.is_owner ? (
                  <span className="text-[13px] text-zinc-400">해제할 수 없어요</span>
                ) : (
                  !isMe && (
                    <Button variant="dangerGhost" size="sm" onClick={() => onRevoke(a)}>
                      권한 해제
                    </Button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
