"use client";

import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, PasswordChecklist, PasswordInput } from "@/components/ui/Field";
import { useFormFields } from "@/lib/hooks/useFormFields";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { PASSWORD_RULE_TEXT, PASSWORD_RULES, passwordConfirmError, passwordError } from "@/lib/validation";
import { updatePassword } from "../actions";

const COPY = {
  invite: {
    title: "계정 활성화",
    lead: (email) => `${email} 계정에 쓸 비밀번호를 정해주세요. 이름과 담당 정보는 운영진이 이미 등록해뒀어요.`,
    submit: "비밀번호 설정하고 시작하기",
  },
  reset: {
    title: "새 비밀번호 설정",
    lead: (email) => `${email} 계정의 새 비밀번호를 입력해주세요.`,
    submit: "비밀번호 바꾸기",
  },
};

function validate(values) {
  const errors = {
    password: passwordError(values.password),
    passwordConfirm: passwordConfirmError(values.password, values.passwordConfirm),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

/** mode: "invite" (first password after an invitation) or "reset" (after a forgot-password link). */
export function SetPasswordForm({ email, mode }) {
  const router = useRouter();
  const copy = COPY[mode] ?? COPY.reset;
  const form = useFormFields({ password: "", passwordConfirm: "" }, validate);
  const { run, pending, error, setError } = useServerAction(updatePassword);

  function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!form.isValid) {
      form.revealErrors(formElement);
      return;
    }
    run(
      form.values,
      (result) => {
        router.replace(result.redirectTo);
        router.refresh();
      },
      (result) => {
        if (form.setServerError(result?.field, result?.error, formElement)) setError(null);
      }
    );
  }

  return (
    <AuthShell title={copy.title} lead={copy.lead(email)}>
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field
          label="새 비밀번호"
          required
          error={form.errorFor("password")}
          hint={<PasswordChecklist password={form.values.password} rules={PASSWORD_RULES} />}
        >
          {(id, aria) => <PasswordInput id={id} {...aria} autoComplete="new-password" placeholder={PASSWORD_RULE_TEXT} {...form.bind("password")} />}
        </Field>
        <Field label="비밀번호 확인" required error={form.errorFor("passwordConfirm")}>
          {(id, aria) => <PasswordInput id={id} {...aria} autoComplete="new-password" placeholder="한 번 더 입력" {...form.bind("passwordConfirm")} />}
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" block loading={pending} aria-disabled={!form.isValid || undefined}>
          {copy.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
