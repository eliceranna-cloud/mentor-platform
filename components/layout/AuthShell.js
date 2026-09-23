import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Brand } from "./Brand";

/** Centered card used by every sign-in / sign-up / password screen. */
export function AuthShell({ title, lead, back, footer, children }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[416px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-card sm:p-8">
        <div className="mb-6">
          <Brand />
        </div>
        {back && (
          <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
        {lead && <p className="mb-6 mt-2 text-[15px] text-zinc-600">{lead}</p>}
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm text-zinc-600">{footer}</div>}
      </div>
    </main>
  );
}
