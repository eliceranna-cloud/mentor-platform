import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Brand } from "./Brand";

/**
 * Sticky header for signed-in pages.
 * `context` is a chip describing where the user is (region, "관리자").
 */
export function TopBar({ context, name, roleLabel }) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
        <Brand compact />
        <div className="flex min-w-0 items-center gap-2">
          {context}
          <span className="hidden h-8 items-center gap-2 rounded-full bg-zinc-100 pl-1 pr-3 sm:inline-flex">
            <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white" aria-hidden>
              {name.charAt(0)}
            </span>
            <span className="max-w-32 truncate text-sm font-semibold">{name}</span>
            <span className="text-xs text-zinc-600">{roleLabel}</span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="로그아웃"
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/** Small pill in the header, e.g. "동남권 · 울산". */
export function ContextChip({ Icon, children }) {
  return (
    <span className="inline-flex h-8 min-w-0 items-center gap-1 rounded-full bg-blue-50 px-3 text-sm font-semibold text-blue-700">
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}
