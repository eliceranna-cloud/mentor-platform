"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button, TextButton } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { forgetPendingSignupEmail, usePendingSignupEmail } from "@/lib/auth/pendingSignup";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { emailError } from "@/lib/validation";
import { resendSignupCode, verifySignupCode } from "../../actions";

const MIN_CODE_LENGTH = 6;

/**
 * Step 2 of sign-up: email + the code from the email. Reachable right after
 * sign-up, from the button in the code email, from the sign-up page and from
 * the login page (when the email was never confirmed). The email is filled in
 * when this device started the sign-up; otherwise the student types it.
 */
export function VerifyCodeForm() {
  const router = useRouter();
  const toast = useToast();
  const remembered = usePendingSignupEmail();
  const [typedEmail, setTypedEmail] = useState(null);
  const email = typedEmail ?? remembered;
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const verify = useServerAction(verifySignupCode);
  const resend = useServerAction(resendSignupCode);

  function check({ needCode }) {
    const next = {
      email: emailError(email) ?? undefined,
      code: needCode && code.length < MIN_CODE_LENGTH ? "메일로 받은 인증 코드를 입력해주세요." : undefined,
    };
    setErrors(next);
    return !next.email && !next.code;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!check({ needCode: true })) return;
    verify.run({ email, code }, (result) => {
      forgetPendingSignupEmail();
      router.replace(result.redirectTo);
      router.refresh();
    });
  }

  function handleResend() {
    if (!check({ needCode: false })) return;
    resend.run({ email }, () => toast("인증 코드를 다시 보냈어요"));
  }

  const serverError = verify.error || resend.error;

  return (
    <AuthShell
      title="인증 코드 입력"
      lead="회원가입할 때 받은 메일의 인증 코드를 입력하면 가입이 끝나요. 메일이 안 보이면 스팸함도 확인해주세요."
      back={{ href: "/login", label: "로그인으로" }}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        <Field label="이메일" required error={errors.email}>
          {(id, aria) => (
            <Input
              id={id}
              {...aria}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => {
                setTypedEmail(event.target.value);
                setErrors((e) => ({ ...e, email: undefined }));
              }}
            />
          )}
        </Field>
        <Field label="인증 코드" required error={errors.code} hint="메일 속 숫자를 그대로 붙여넣어도 돼요.">
          {(id, aria) => (
            <Input
              id={id}
              {...aria}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={16}
              placeholder="12345678"
              className="tnum text-center text-xl tracking-[0.3em]"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 10));
                setErrors((e) => ({ ...e, code: undefined }));
              }}
            />
          )}
        </Field>

        {serverError && <Alert tone="error">{serverError}</Alert>}

        <Button type="submit" size="lg" block loading={verify.pending}>
          <MailCheck className="size-4" aria-hidden />
          인증하고 시작하기
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/signup" className="font-semibold text-zinc-600 hover:underline">
          처음부터 다시 가입하기
        </Link>
        <TextButton disabled={resend.pending} onClick={handleResend}>
          코드 다시 받기
        </TextButton>
      </div>
    </AuthShell>
  );
}
