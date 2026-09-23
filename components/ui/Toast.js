"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

const ToastContext = createContext(() => {});

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
const DURATION_MS = 3200;

/** App-wide short notifications ("예약을 취소했어요"). One at a time. */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, tone = "success") => {
    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  const Icon = toast ? ICONS[toast.tone] : null;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4">
        {toast && (
          <div
            key={toast.key}
            role="status"
            className="flex max-w-full items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-card"
          >
            <Icon className={`size-4 shrink-0 ${toast.tone === "error" ? "text-red-300" : ""}`} aria-hidden />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast("저장했어요"); toast("실패했어요", "error"); */
export function useToast() {
  return useContext(ToastContext);
}
