import { Compass } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "페이지를 찾을 수 없어요" };

// Shown for any URL that is not a page in this app.
export default function NotFound() {
  return (
    <AuthShell title="페이지를 찾을 수 없어요" lead="주소가 바뀌었거나 없는 페이지예요. 처음 화면에서 다시 시작해주세요.">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
          <Compass className="size-6" aria-hidden />
        </span>
        <span className="tnum text-4xl font-bold text-zinc-300">404</span>
      </div>
      <Button href="/" size="lg" block>
        처음 화면으로
      </Button>
    </AuthShell>
  );
}
