"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { run, pending, error } = useServerAction(requestPasswordReset);

  if (sent) {
    return (
      <AuthShell
        title="메일을 확인해주세요"
        lead="입력하신 이메일로 가입된 계정이 있다면 비밀번호 재설정 링크를 보냈어요. 링크를 눌러 새 비밀번호를 정하면 돼요. 메일이 안 보이면 스팸함도 확인해주세요."
      >
        <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Mail className="size-6" aria-hidden />
        </div>
        <Button href="/login" size="lg" block>
          로그인으로 돌아가기
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="비밀번호 찾기"
      lead="가입한 이메일을 입력하면 재설정 링크를 보내드려요. 초대 메일을 잃어버린 멘토와 운영진도 여기서 새 링크를 받을 수 있어요."
      back={{ href: "/login", label: "로그인으로" }}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          run({ email }, () => setSent(true));
        }}
      >
        <Field label="이메일" required>
          {(id, aria) => (
            <Input id={id} {...aria} type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          )}
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" block loading={pending}>
          재설정 링크 받기
        </Button>
      </form>
    </AuthShell>
  );
}
