import { cn } from "@/lib/cn";

/**
 * Underlined page tabs with optional counts. Scrolls sideways on narrow
 * screens instead of wrapping.
 * items: [{ value, label, count? }]
 */
export function Tabs({ items, value, onChange, label }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 mb-6 flex gap-6 overflow-x-auto border-b border-zinc-200 px-4 sm:mx-0 sm:px-0"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 pb-3 text-base font-semibold transition-colors",
              active ? "border-ink text-zinc-900" : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "tnum inline-flex h-5 min-w-6 items-center justify-center rounded-full px-2 text-xs",
                  active ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pill switcher (region filter, calendar/list, mentor picker on phones).
 * `scrollable` lets many options scroll sideways instead of squashing.
 */
export function SegmentedControl({ options, value, onChange, label, scrollable = false, className }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex gap-1 rounded-full bg-zinc-200/70 p-1",
        scrollable && "max-w-full overflow-x-auto",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 shrink-0 rounded-full px-4 text-sm font-semibold transition",
              active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
