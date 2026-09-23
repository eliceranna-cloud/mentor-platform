import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { getSession, ROLE_HOME } from "@/lib/auth/session";

/**
 * Entry point. Sends everyone to the one place they belong:
 * signed out -> /login, otherwise the home page for their role.
 */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role) redirect(ROLE_HOME[session.role]);

  // Signed in, but not linked to any roster (e.g. admin access was revoked).
  return (
    <AuthShell
      title="접근 권한이 없어요"
      lead={`${session.user.email} 계정은 아직 학생, 멘토, 운영진 명단에 연결되지 않았어요. 운영 사무국에 문의해주세요.`}
    >
      <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <ShieldAlert className="size-6" aria-hidden />
      </div>
      <form action={signOut}>
        <Button type="submit" size="lg" block>
          다른 계정으로 로그인
        </Button>
      </form>
    </AuthShell>
  );
}
