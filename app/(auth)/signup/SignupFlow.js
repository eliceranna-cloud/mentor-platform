"use client";

import { CircleCheck, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button, TextButton } from "@/components/ui/Button";
import { CheckboxCard, Field, Input, PasswordChecklist, PasswordInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useFormFields } from "@/lib/hooks/useFormFields";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { isValidEmail, normalizeEmail, PASSWORD_RULE_TEXT, PASSWORD_RULES, signupErrors } from "@/lib/validation";
import { checkSignupEmail, resendSignupCode, signUpStudent, verifySignupCode } from "../actions";

const EMPTY = { email: "", phone: "", password: "", passwordConfirm: "", consent: false };

/**
 * Two steps on one page: details -> one-time code sent by email (its length is a Supabase setting, currently 8 digits).
 * Name, region and local area come from the roster, so the student only types
 * what the roster does not have.
 */
export function SignupFlow({ verifyEmail }) {
  const [pendingEmail, setPendingEmail] = useState(verifyEmail);
  const [greetingName, setGreetingName] = useState(null);

  if (pendingEmail) {
    return <VerifyStep email={pendingEmail} name={greetingName} onChangeEmail={() => setPendingEmail(null)} />;
  }
  return (
    <DetailsStep
      onSent={(result) => {
        setGreetingName(result.name);
        setPendingEmail(result.email);
      }}
    />
  );
}

/**
 * Whether the typed email is on the LXP roster, checked by the server shortly
 * after the student stops typing. Only the latest email's answer is kept.
 * status: idle | checking | available | not_on_roster | registered | error
 */
function useRosterCheck() {
  const [check, setCheck] = useState({ email: "", status: "idle", message: null });
  const timer = useRef(null);
  const latest = useRef("");

  const run = useCallback(async (email) => {
    setCheck({ email, status: "checking", message: null });
    try {
      const result = await checkSignupEmail({ email });
      if (latest.current !== email) return;
      setCheck(result.ok ? { email, status: result.status, message: result.message } : { email, status: "error", message: null });
    } catch {
      // Network trouble: let the student submit; the server checks again.
      if (latest.current === email) setCheck({ email, status: "error", message: null });
    }
  }, []);

  /** Call on every change; checks 400ms after typing stops. */
  const schedule = useCallback(
    (rawEmail) => {
      const email = normalizeEmail(rawEmail);
      latest.current = email;
      clearTimeout(timer.current);
      if (isValidEmail(email)) timer.current = setTimeout(() => run(email), 400);
    },
    [run]
  );

  /** Call on blur: checks now instead of waiting for the timer. */
  const flush = useCallback(
    (rawEmail) => {
      const email = normalizeEmail(rawEmail);
      if (!isValidEmail(email) || check.email === email) return;
      clearTimeout(timer.current);
      run(email);
    },
    [check.email, run]
  );

  return { check, schedule, flush };
}

function DetailsStep({ onSent }) {
  const roster = useRosterCheck();
  const form = useFormFields(EMPTY, (values) => {
    const errors = signupErrors(values);
    const current = roster.check.email === normalizeEmail(values.email);
    if (!errors.email && current && roster.check.message) errors.email = roster.check.message;
    return errors;
  });
  const { run, pending, error, setError } = useServerAction(signUpStudent);

  const { values } = form;
  const emailChecked = roster.check.email === normalizeEmail(values.email);
  const emailConfirmed = emailChecked && ["available", "error"].includes(roster.check.status);
  const checkingEmail = !emailConfirmed && isValidEmail(values.email) && !(emailChecked && roster.check.message);
  const canSubmit = form.isValid && emailConfirmed;

  const emailBinding = form.bind("email");
  const emailHint =
    emailChecked && roster.check.status === "available" ? (
      <span className="inline-flex items-center gap-1 text-green-700">
        <CircleCheck className="size-3.5" aria-hidden />
        <span>LXP 수강생 명단에서 확인됐어요.</span>
      </span>
    ) : checkingEmail && !form.errorFor("email") ? (
      <span>LXP 수강생 명단을 확인하고 있어요…</span>
    ) : null;

  function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!canSubmit) {
      form.revealErrors(formElement);
      return;
    }
    run(values, onSent, (result) => {
      if (form.setServerError(result?.field, result?.error, formElement)) setError(null);
    });
  }

  return (
    <AuthShell
      title="학생 회원가입"
      lead="LXP(엘리스 학습 사이트)에 등록한 이메일로 가입해주세요. 이름과 권역은 수강생 명단에서 자동으로 확인해요."
      back={{ href: "/login", label: "로그인으로" }}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        <Field
          label="이메일"
          required
          info="Elice LXP(엘리스 학습 사이트)에 등록한 이메일과 같아야 해요."
          error={form.errorFor("email")}
          hint={emailHint}
        >
          {(id, aria) => (
            <Input
              id={id}
              {...aria}
              type="email"
              autoComplete="email"
              inputMode="email"
              {...emailBinding}
              onChange={(event) => {
                emailBinding.onChange(event);
                roster.schedule(event.target.value);
              }}
              onBlur={(event) => {
                emailBinding.onBlur();
                roster.flush(event.target.value);
              }}
            />
          )}
        </Field>
        <Field label="휴대전화 번호" required info="멘토링 예약 확인 용도로만 사용해요." error={form.errorFor("phone")}>
          {(id, aria) => (
            <Input id={id} {...aria} type="tel" autoComplete="tel" inputMode="numeric" placeholder="010-1234-5678" className="tnum" {...form.bind("phone")} />
          )}
        </Field>
        <Field
          label="비밀번호"
          required
          error={form.errorFor("password")}
          hint={<PasswordChecklist password={values.password} rules={PASSWORD_RULES} />}
        >
          {(id, aria) => <PasswordInput id={id} {...aria} autoComplete="new-password" placeholder={PASSWORD_RULE_TEXT} {...form.bind("password")} />}
        </Field>
        <Field label="비밀번호 확인" required error={form.errorFor("passwordConfirm")}>
          {(id, aria) => <PasswordInput id={id} {...aria} autoComplete="new-password" placeholder="한 번 더 입력" {...form.bind("passwordConfirm")} />}
        </Field>
        <CheckboxCard {...form.bind("consent")} error={form.errorFor("consent")}>
          <b className="text-sm text-zinc-900">[필수] 개인정보 수집·이용 동의</b>
          <br />
          수집 항목: 이름, 이메일, 전화번호 · 이용 목적: 멘토링 예약 확인과 미참석 시 연락 · 보유 기간: 프로그램 종료 후 파기
        </CheckboxCard>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" block loading={pending} aria-disabled={!canSubmit || undefined}>
            인증 코드 받기
          </Button>
          {!canSubmit && <p className="text-center text-[13px] text-zinc-500">필수 항목(*)을 모두 올바르게 입력하고 동의하면 인증 코드를 받을 수 있어요.</p>}
        </div>
      </form>
    </AuthShell>
  );
}

function VerifyStep({ email, name, onChangeEmail }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const verify = useServerAction(verifySignupCode);
  const resend = useServerAction(resendSignupCode);

  return (
    <AuthShell
      title="이메일 인증"
      lead={`${name ? `${name}님, ` : ""}${email} 으로 인증 코드를 보냈어요. 메일이 안 보이면 스팸함도 확인해주세요.`}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          verify.run({ email, code }, (result) => {
            router.replace(result.redirectTo);
            router.refresh();
          });
        }}
      >
        <Field label="인증 코드" required>
          {(id, aria) => (
            <Input
              id={id}
              {...aria}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="12345678"
              className="tnum text-center text-xl tracking-[0.4em]"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          )}
        </Field>

        {(verify.error || resend.error) && <Alert tone="error">{verify.error || resend.error}</Alert>}

        <Button type="submit" size="lg" block loading={verify.pending}>
          <MailCheck className="size-4" aria-hidden />
          인증하고 시작하기
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <TextButton muted onClick={onChangeEmail}>
          정보 다시 입력하기
        </TextButton>
        <TextButton disabled={resend.pending} onClick={() => resend.run({ email }, () => toast("인증 코드를 다시 보냈어요"))}>
          코드 다시 받기
        </TextButton>
      </div>
    </AuthShell>
  );
}
