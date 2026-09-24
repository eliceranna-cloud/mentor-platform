"use client";

import { useSyncExternalStore } from "react";

// Remembers, on this device only, which email is waiting for its sign-up code,
// so the "인증 코드 입력" page can fill it in (also when opened later from the
// email in a new tab). localStorage, not the URL, so the address does not end
// up in browser history or server logs. Every access is guarded: storage can
// be blocked (private mode, strict settings), and the page still works then;
// the student just types the email.

const KEY = "mentor-booking:pending-signup-email";
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function write(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to remember.
  }
  listeners.forEach((notify) => notify());
}

export const rememberPendingSignupEmail = (email) => write(email);
export const forgetPendingSignupEmail = () => write("");

function subscribe(notify) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The remembered email, or "" (always "" during server rendering). */
export function usePendingSignupEmail() {
  return useSyncExternalStore(subscribe, read, () => "");
}
