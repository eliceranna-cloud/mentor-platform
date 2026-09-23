import { REGION_TONE } from "@/lib/booking/constants";
import { cn } from "@/lib/cn";

const TONES = {
  dn: "bg-region-dn-soft text-region-dn",
  cc: "bg-region-cc-soft text-region-cc",
  neutral: "bg-zinc-100 text-zinc-600",
  ok: "bg-green-50 text-green-700",
  warn: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
};

/** Small rounded label. Colour is never the only signal: it always has text. */
export function Chip({ tone = "neutral", className, children }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** "동남권 · 울산" chip in the region's colour. */
export function RegionChip({ group, area, className }) {
  return (
    <Chip tone={REGION_TONE[group] ?? "neutral"} className={className}>
      {group}
      {area ? ` · ${area}` : ""}
    </Chip>
  );
}

export function TestChip() {
  return <Chip tone="warn">테스트</Chip>;
}
