import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-ink-hover",
  blue: "bg-blue-600 text-white hover:bg-blue-700",
  outline: "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
  dangerGhost: "bg-transparent text-red-600 hover:bg-red-50",
};

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-transparent font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-zinc-200 disabled:text-zinc-400 " +
  // aria-disabled: looks disabled but still receives clicks, so a form can
  // point to what is missing instead of silently ignoring the tap.
  "aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-zinc-200 aria-disabled:text-zinc-400 " +
  "aria-disabled:hover:bg-zinc-200";

export function buttonClasses({ variant = "primary", size = "md", block = false, className } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className);
}

/**
 * The one button used across the app.
 * - `loading` disables it and shows a spinner (prevents double submits).
 * - `href` renders a link styled as a button; `external` opens a new tab.
 */
export function Button({
  variant,
  size,
  block,
  loading = false,
  href,
  external = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}) {
  const classes = buttonClasses({ variant, size, block, className });

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes} {...props}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  // The spinner is always mounted and only shown or hidden, and the label sits
  // in its own element. Inserting a spinner next to a bare text node crashes
  // React ("insertBefore ... not a child of this node") when browser
  // translation (e.g. Chrome's Korean -> English) has replaced that text node.
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <LoaderCircle className={cn("size-4 animate-spin", !loading && "hidden")} aria-hidden />
      <span className="contents">{children}</span>
    </button>
  );
}

/** Inline text button, e.g. "비밀번호 찾기". */
export function TextButton({ muted = false, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold hover:underline",
        muted ? "text-zinc-600" : "text-blue-600",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
