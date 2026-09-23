"use client";

import { Video } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SummaryList } from "@/components/ui/Display";
import { Modal } from "@/components/ui/Modal";
import { endTime, formatDate } from "@/lib/booking/dates";

/** Date / time / mentor summary used in several dialogs. */
export function SlotSummary({ date, time, mentorLabel, className }) {
  return (
    <SummaryList
      className={className}
      rows={[
        ["날짜", formatDate(date)],
        ["시간", `${time} ~ ${endTime(time)}`],
        ["멘토", mentorLabel],
      ]}
    />
  );
}

/** Mentor introduction, opened from the board header. */
export function MentorInfoModal({ mentor, onClose }) {
  return (
    <Modal
      title={`${mentor.name} 멘토`}
      description={`${mentor.field} · ${mentor.region_group}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>확인</Button>}
    >
      {mentor.intro && <p className="text-[15px] leading-relaxed">{mentor.intro}</p>}
      <Alert tone="info" icon={Video} className="mt-4">
        멘토링은 온라인 라이브 강의실에서 진행돼요. 입장 링크는 예약한 뒤 &apos;내 예약&apos;에서 볼 수 있어요.
      </Alert>
    </Modal>
  );
}

/** "Are you sure?" dialog. Shared by cancel, revoke and similar actions. */
export function ConfirmModal({ title, description, confirmLabel, keepLabel = "유지하기", danger = true, busy, onConfirm, onClose, children }) {
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {keepLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
