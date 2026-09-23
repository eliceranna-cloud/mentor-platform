"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Centered dialog. Closes on Esc, on backdrop click and via the X button.
 * Focus moves into the dialog when it opens and back to the trigger when it
 * closes. Body scroll is locked while open.
 */
export function Modal({ title, description, onClose, footer, children, size = "md" }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const firstField = dialogRef.current?.querySelector("input, select, textarea, button:not([data-close])");
    (firstField ?? dialogRef.current)?.focus();

    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[calc(100dvh-16px)] w-full overflow-y-auto rounded-t-2xl bg-white p-6 pb-safe shadow-2xl outline-none sm:max-h-[calc(100dvh-32px)] sm:rounded-2xl sm:pb-6 ${
          size === "lg" ? "sm:max-w-xl" : "sm:max-w-md"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="닫기"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}
