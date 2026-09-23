import { cn } from "@/lib/cn";
import { TAGLINE } from "./Brand";

/** Width and padding for signed-in pages. Bottom padding leaves room for the booking tray. */
export function PageContainer({ children }) {
  return <main className="mx-auto max-w-[1240px] px-4 pb-40 pt-6 sm:px-6 sm:pt-8">{children}</main>;
}

/**
 * Page heading block: tagline, title, meta facts, and an optional aside
 * (next-session card, region filter) that wraps under the title on phones.
 * meta: [{ Icon, text }]
 */
export function PageHero({ title, meta = [], aside }) {
  return (
    <section className="mb-6 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        <p className="mb-1 text-sm font-semibold text-blue-600">{TAGLINE}</p>
        <h1 className="text-[22px] font-bold leading-snug sm:text-[28px]">{title}</h1>
        {meta.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
            {meta.map(({ Icon, text }) => (
              <span key={text} className="tnum inline-flex items-center gap-1">
                <Icon className="size-4" aria-hidden />
                {text}
              </span>
            ))}
          </p>
        )}
      </div>
      {aside && <div className="w-full sm:w-auto">{aside}</div>}
    </section>
  );
}

/** Row of controls above a board or list. */
export function Toolbar({ className, children }) {
  return <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-3", className)}>{children}</div>;
}
