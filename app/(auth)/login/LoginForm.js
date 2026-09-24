"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Field";
import { rememberPendingSignupEmail } from "@/lib/auth/pendingSignup";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { isValidEmail } from "@/lib/validation";
import { signIn } from "../actions";

/** Both fields are required; returns per-field messages, empty when valid. */
function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "이메일을 입력해주세요.";
  else if (!isValidEmail(email)) errors.email = "이메일 형식을 확인해주세요.";
  if (!password) errors.password = "비밀번호를 입력해주세요.";
  return errors;
}

/** Single login for students, mentors and admins. The account decides the destination. */
export function LoginForm({ linkError }) {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [needsVerification, setNeedsVerification] = useState(false);
  const { run, pending, error } = useServerAction(signIn);

  const update = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setFieldErrors((errors) => ({ ...errors, [key]: undefined }));
  };

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setNeedsVerification(false);
    run(
      values,
      (result) => {
        router.replace(result.redirectTo);
        router.refresh();
      },
      (result) => setNeedsVerification(Boolean(result?.needsVerification))
    );
  }

  return (
    <AuthShell
      title="로그인"
      footer={
        <>
          <Link href="/forgot-password" className="font-semibold text-zinc-600 hover:underline">
            비밀번호 찾기
          </Link>
          <span>
            학생이신가요?{" "}
            <Link href="/signup" className="font-semibold text-blue-600 hover:underline">
              회원가입
            </Link>
          </span>
        </>
      }
    >
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Field label="이메일" required error={fieldErrors.email}>
          {(id, aria) => (
            <Input id={id} {...aria} type="email" autoComplete="email" inputMode="email" value={values.email} onChange={update("email")} required />
          )}
        </Field>
        <Field label="비밀번호" required error={fieldErrors.password}>
          {(id, aria) => (
            <PasswordInput id={id} {...aria} autoComplete="current-password" value={values.password} onChange={update("password")} required />
          )}
        </Field>

        {linkError && !error && <Alert tone="error">{linkError}</Alert>}
        {error && (
          <Alert tone="error">
            <span>{error}</span>
            {needsVerification && (
              <Link href="/signup/verify" onClick={() => rememberPendingSignupEmail(values.email)} className="ml-1 font-semibold underline">
                인증 코드 입력하기
              </Link>
            )}
          </Alert>
        )}

        <Button type="submit" size="lg" block loading={pending}>
          로그인
        </Button>
      </form>
    </AuthShell>
  );
}
