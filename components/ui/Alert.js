import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/cn";

const TONES = {
  error: { className: "bg-red-50 text-red-800", Icon: CircleAlert, role: "alert" },
  success: { className: "bg-green-50 text-green-800", Icon: CircleCheck, role: "status" },
  info: { className: "bg-blue-50 text-blue-900", Icon: Info, role: "status" },
};

/** Inline message block. Always icon + text, never colour alone. */
export function Alert({ tone = "info", icon, className, children }) {
  const { className: toneClass, Icon, role } = TONES[tone];
  const ShownIcon = icon ?? Icon;
  return (
    <div role={role} className={cn("flex items-start gap-2 rounded-lg px-4 py-3 text-sm leading-relaxed", toneClass, className)}>
      <ShownIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
