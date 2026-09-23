import { describeDate, endTime } from "@/lib/booking/dates";
import { cn } from "@/lib/cn";

/**
 * List row for one booking: date block on the left, details in the middle,
 * actions on the right (wrapping under the details on phones).
 */
export function BookingRow({ date, time, title, subtitle, actions, muted = false, onClick }) {
  const d = describeDate(date);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={cn(
        "flex w-full flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left sm:flex-nowrap",
        muted && "opacity-60",
        onClick && "hover:border-zinc-300"
      )}
    >
      <div className="tnum w-16 shrink-0 border-r border-zinc-200 pr-4 text-center">
        <b className="block text-lg">{d.monthDay}</b>
        <small className="text-[13px] text-zinc-600">{d.weekday}요일</small>
      </div>
      <div className="min-w-0 flex-1">
        <p className="tnum flex flex-wrap items-center gap-2 text-[15px] font-bold">
          {time && `${time} ~ ${endTime(time)}`}
          {title}
        </p>
        {subtitle && <div className="text-sm text-zinc-600">{subtitle}</div>}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto">{actions}</div>}
    </Tag>
  );
}
