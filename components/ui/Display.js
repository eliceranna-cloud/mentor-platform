import { Info } from "lucide-react";
import { REGION_TONE } from "@/lib/booking/constants";
import { cn } from "@/lib/cn";

/** Initial in a circle, tinted by region. */
export function Avatar({ name, group, size = "md", className }) {
  const tone = REGION_TONE[group];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" ? "size-6 text-xs" : "size-8 text-sm",
        tone === "dn" ? "bg-region-dn-soft text-region-dn" : tone === "cc" ? "bg-region-cc-soft text-region-cc" : "bg-ink text-white",
        className
      )}
    >
      {String(name ?? "?").charAt(0)}
    </span>
  );
}

/** Row of headline numbers at the top of mentor and admin dashboards. */
export function KpiGrid({ items }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
      {items.map(({ label, value, sub, Icon }) => (
        <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="flex items-center gap-1 text-[13px] text-zinc-600">
            <Icon className="size-4" aria-hidden />
            {label}
          </p>
          <p className="tnum mt-1 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
          <p className="text-xs text-zinc-400">{sub}</p>
        </div>
      ))}
    </div>
  );
}

/** Dashed box for "nothing here yet", with an optional action. */
export function EmptyState({ Icon, message, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-zinc-600">
      {Icon && <Icon className="mx-auto mb-2 size-8 text-zinc-400" aria-hidden />}
      <p className={action ? "mb-4" : ""}>{message}</p>
      {action}
    </div>
  );
}

/** One-line helper text with an info icon, used above boards and lists. */
export function Hint({ Icon = Info, className, children }) {
  return (
    <p className={cn("mb-4 flex items-start gap-2 text-[13px] text-zinc-600", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Label/value rows in a grey box (booking summary, profile summary). */
export function SummaryList({ rows, className }) {
  return (
    <dl className={cn("rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2", className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-zinc-200 py-2 text-sm [&+&]:border-t">
          <dt className="shrink-0 text-zinc-600">{label}</dt>
          <dd className="tnum text-right font-semibold break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Centered spinner area while data loads. */
export function LoadingBlock({ label = "불러오는 중..." }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
      <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" aria-hidden />
      {label}
    </div>
  );
}
