"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { SESSION_STATUS, SESSION_STATUS_ORDER } from "@/lib/booking/session";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Read-only chip for a recorded session outcome. */
export function SessionStatusChip({ status }) {
  const meta = SESSION_STATUS[status];
  if (!meta) return null;
  return (
    <Chip tone={meta.tone}>
      <span aria-hidden>{meta.mark}</span>
      {meta.label}
    </Chip>
  );
}

/**
 * 완료 / 취소 / 일정 변경 buttons for a session that has started.
 * Pressing the selected option again clears it. Saves through
 * public.log_session(), which checks the caller is the mentor (or an admin).
 */
export function SessionStatusPicker({ bookingId, status, onSaved }) {
  const toast = useToast();
  const [saving, setSaving] = useState(null);

  async function choose(next) {
    const value = next === status ? null : next;
    setSaving(next);
    const { error } = await getSupabaseBrowserClient().rpc("log_session", { p_booking_id: bookingId, p_status: value });
    setSaving(null);
    if (error) return toast(toUserMessage(error), "error");
    toast(value ? `세션을 '${SESSION_STATUS[value].label}'(으)로 기록했어요` : "세션 기록을 지웠어요");
    onSaved?.(value);
  }

  return (
    <div role="group" aria-label="세션 기록" className="flex flex-wrap gap-1">
      {SESSION_STATUS_ORDER.map((key) => {
        const active = key === status;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            disabled={saving !== null}
            onClick={() => choose(key)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60",
              active ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
            )}
          >
            <span aria-hidden>{SESSION_STATUS[key].mark}</span>
            {SESSION_STATUS[key].label}
          </button>
        );
      })}
    </div>
  );
}
