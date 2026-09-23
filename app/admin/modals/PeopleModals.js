"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toUserMessage } from "@/lib/errors";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPhone, isValidEmail, isValidHttpUrl, isValidPhone, normalizeEmail } from "@/lib/validation";
import { inviteAdmin } from "../actions";

const UNIQUE_VIOLATION = "23505";

/** Small form state helper for the modals below. */
function useFormValues(initial) {
  const [values, setValues] = useState(initial);
  const bind = (key) => ({ value: values[key] ?? "", onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value })) });
  return [values, bind, setValues];
}

/**
 * Edit a mentor's email, phone, classroom link and profile text. The email is locked
 * once an account exists for it, because the account is tied to that address.
 */
export function MentorEditModal({ mentor, onSaved, onClose }) {
  const [values, bind] = useFormValues({
    email: mentor.email ?? "",
    phone: mentor.phone ?? "",
    meeting_link: mentor.meeting_link ?? "",
    field: mentor.field ?? "",
    intro: mentor.intro ?? "",
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const emailLocked = Boolean(mentor.user_id);

  async function save(event) {
    event.preventDefault();
    const email = normalizeEmail(values.email) || null;
    const link = values.meeting_link.trim() || null;
    const phone = values.phone.trim() ? formatPhone(values.phone) : null;
    if (email && !isValidEmail(email)) return setError("이메일 형식을 확인해주세요.");
    if (phone && !isValidPhone(phone)) return setError("휴대전화 번호를 확인해주세요. 예: 010-1234-5678");
    if (link && !isValidHttpUrl(link)) return setError("링크는 http 또는 https로 시작해야 해요.");
    if (!values.field.trim()) return setError("분야를 입력해주세요.");

    setBusy(true);
    setError(null);
    const patch = { phone, meeting_link: link, field: values.field.trim(), intro: values.intro.trim(), updated_at: new Date().toISOString() };
    if (!emailLocked) patch.email = email;
    const { error: dbError } = await getSupabaseBrowserClient().from("mentors").update(patch).eq("id", mentor.id);
    setBusy(false);
    if (dbError?.code === UNIQUE_VIOLATION) return setError("다른 멘토가 이미 쓰고 있는 이메일이에요.");
    if (dbError) return setError(toUserMessage(dbError));
    onSaved();
  }

  return (
    <Modal
      title={`${mentor.name} 멘토 정보`}
      description={mentor.region_group}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" form="mentor-edit" loading={busy}>
            저장
          </Button>
        </>
      }
    >
      <form id="mentor-edit" className="flex flex-col gap-4" onSubmit={save} noValidate>
        <Field label="이메일" hint={emailLocked ? "계정이 만들어진 뒤에는 이메일을 바꿀 수 없어요." : "초대 메일을 받을 주소예요."}>
          {(id, aria) => <Input id={id} {...aria} type="email" placeholder="mentor@example.com" disabled={emailLocked} {...bind("email")} />}
        </Field>
        <Field label="휴대전화 번호" hint="운영진만 볼 수 있어요. 학생에게는 보이지 않아요.">
          {(id, aria) => <Input id={id} {...aria} type="tel" inputMode="numeric" placeholder="010-1234-5678" className="tnum" {...bind("phone")} />}
        </Field>
        <Field label="라이브 강의실 링크" hint="학생에게는 예약한 뒤에 보이고, 멘토에게는 항상 보여요.">
          {(id, aria) => <Input id={id} {...aria} type="url" placeholder="https://..." {...bind("meeting_link")} />}
        </Field>
        <Field label="분야">{(id, aria) => <Input id={id} {...aria} {...bind("field")} />}</Field>
        <Field label="소개">{(id, aria) => <Textarea id={id} {...aria} rows={3} {...bind("intro")} />}</Field>
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}

/**
 * Add a student to the roster (or fix a row before they sign up), e.g. when
 * someone was rejected at sign-up and contacted the office.
 */
export function RosterStudentModal({ row, regions, onSaved, onClose }) {
  const isEdit = Boolean(row);
  const [values, bind, setValues] = useFormValues({
    email: row?.email ?? "",
    name: row?.name ?? "",
    region_group: row?.region_group ?? regions[0].name,
    region: row?.region ?? regions[0].areas[0],
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const areas = regions.find((r) => r.name === values.region_group)?.areas ?? [];

  async function save(event) {
    event.preventDefault();
    const email = normalizeEmail(values.email);
    if (!isValidEmail(email)) return setError("이메일 형식을 확인해주세요.");
    if (!values.name.trim()) return setError("이름을 입력해주세요.");

    setBusy(true);
    setError(null);
    const record = { email, name: values.name.trim(), region_group: values.region_group, region: values.region };
    const table = getSupabaseBrowserClient().from("whitelist_students");
    const { error: dbError } = isEdit ? await table.update(record).eq("email", row.email) : await table.insert(record);
    setBusy(false);
    if (dbError?.code === UNIQUE_VIOLATION) return setError("이미 명단에 있는 이메일이에요.");
    if (dbError) return setError(toUserMessage(dbError));
    onSaved();
  }

  return (
    <Modal
      title={isEdit ? "명단 정보 수정" : "학생 명단에 추가"}
      description="가입할 때 이 이메일과 권역이 확인돼요."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" form="roster-student" loading={busy}>
            저장
          </Button>
        </>
      }
    >
      <form id="roster-student" className="flex flex-col gap-4" onSubmit={save} noValidate>
        <Field label="이메일" hint="LXP에 등록된 이메일과 같게 입력해주세요.">
          {(id, aria) => <Input id={id} {...aria} type="email" {...bind("email")} />}
        </Field>
        <Field label="이름">{(id, aria) => <Input id={id} {...aria} {...bind("name")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="권역">
            {(id, aria) => (
              <Select
                id={id}
                {...aria}
                value={values.region_group}
                onChange={(e) => {
                  const group = e.target.value;
                  setValues((v) => ({ ...v, region_group: group, region: regions.find((r) => r.name === group).areas[0] }));
                }}
              >
                {regions.map((r) => (
                  <option key={r.name}>{r.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="지역">
            {(id, aria) => (
              <Select id={id} {...aria} {...bind("region")}>
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}

/** Invite a new operations member by email. */
export function InviteAdminModal({ onDone, onClose }) {
  const [values, bind] = useFormValues({ name: "", email: "" });
  const { run, pending, error } = useServerAction(inviteAdmin);

  return (
    <Modal
      title="멤버 초대"
      description="초대한 이메일로 비밀번호 설정 링크를 보내요."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" form="invite-admin" loading={pending}>
            <Mail className="size-4" aria-hidden />
            초대 보내기
          </Button>
        </>
      }
    >
      <form
        id="invite-admin"
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          run(values, () => onDone(normalizeEmail(values.email)));
        }}
      >
        <Field label="이름">{(id, aria) => <Input id={id} {...aria} placeholder="홍길동" {...bind("name")} />}</Field>
        <Field label="이메일" hint="회사 이메일로 초대하는 것을 권장해요.">
          {(id, aria) => <Input id={id} {...aria} type="email" placeholder="name@elice.io" {...bind("email")} />}
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
