"use client";

import { Check, Dot, Eye, EyeOff, Info } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition " +
  "placeholder:text-zinc-400 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 " +
  "disabled:bg-zinc-50 disabled:text-zinc-500 aria-invalid:border-red-500";

/**
 * Label + control + hint/error, wired together for screen readers.
 * Pass the control as a render function so it receives the id and aria props:
 *   <Field label="이메일" required>{(id, aria) => <Input id={id} {...aria} />}</Field>
 *
 * - `required` shows a red asterisk and sets aria-required.
 * - `info` shows an (i) button next to the label with that text as a tooltip.
 * - `hint` can be text or an element (e.g. <PasswordChecklist />).
 */
export function Field({ label, hint, info, error, required = false, className, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const aria = {
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
  };
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="text-sm font-semibold text-zinc-900">
          {label}
          {required && (
            <>
              <span className="ml-0.5 text-red-600" aria-hidden>
                *
              </span>
              <span className="sr-only">(필수)</span>
            </>
          )}
        </label>
        {info && <InfoTip label={`${label} 안내`}>{info}</InfoTip>}
      </div>
      {children(id, aria)}
      {hint && (
        <div id={hintId} className="text-[13px] text-zinc-600">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="text-[13px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * (i) icon with a short explanation. Opens on hover, keyboard focus, or tap
 * (phones have no hover), closes on blur or Esc.
 */
export function InfoTip({ label, children }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600"
      >
        <Info className="size-4" aria-hidden />
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={cn(
          "absolute left-1/2 top-full z-10 mt-1 w-60 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-[13px] font-normal leading-relaxed text-white shadow-card",
          open ? "block" : "hidden"
        )}
      >
        {children}
      </span>
    </span>
  );
}

export function Input({ className, ...props }) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

/** Password field with a show / hide (eye) toggle. */
export function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={cn(CONTROL, "pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-zinc-400 hover:text-zinc-700"
      >
        <Icon className="size-5" aria-hidden />
      </button>
    </div>
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(CONTROL, "px-3", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(CONTROL, "h-auto min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

/** Checkbox inside a tappable box, used for consent. `error` shows a message below it. */
export function CheckboxCard({ children, className, error, ...props }) {
  const errorId = useId();
  return (
    <div className="flex flex-col gap-2">
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border bg-zinc-50 px-4 py-3 text-[13px] leading-relaxed text-zinc-600",
          error ? "border-red-500" : "border-zinc-200",
          className
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-blue-600"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={errorId} className="text-[13px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Live checklist of the password rules (8자 이상 · 영문 포함 · 숫자 포함).
 * Each rule turns green once met, so the user sees what is still missing.
 */
export function PasswordChecklist({ password, rules }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]" aria-label="비밀번호 조건">
      {rules.map((rule) => {
        const met = rule.test(password);
        const Icon = met ? Check : Dot;
        return (
          <li key={rule.label} className={cn("inline-flex items-center gap-1", met ? "text-green-700" : "text-zinc-500")}>
            <Icon className="size-3.5" aria-hidden />
            <span>{rule.label}</span>
            <span className="sr-only">{met ? "(충족)" : "(미충족)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
