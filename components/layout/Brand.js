import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

export const TAGLINE = "지역 특화 프로젝트를 위한 1:1 멘토링";

/**
 * elice logo + product name. Links home, which routes by role.
 * `compact` hides the name on narrow phones so the header keeps room for the
 * region chip (the page title already says what this is).
 */
export function Brand({ compact = false }) {
  const nameClass = compact ? "hidden min-[420px]:inline" : "inline";
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-bold" aria-label="멘토링 예약 처음 화면">
      <Image src="/elice-logo.png" alt="elice" width={77} height={24} priority className="h-6 w-auto" />
      <span className={cn("h-5 w-px bg-zinc-200", compact ? "hidden min-[420px]:block" : "block")} aria-hidden />
      <span className={nameClass}>멘토링 예약</span>
    </Link>
  );
}
