"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";

// Last-resort screen for unexpected errors while rendering a page.
export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AuthShell title="화면을 불러오지 못했어요" lead="잠시 후 다시 시도해주세요. 문제가 계속되면 운영 사무국에 알려주세요.">
      <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <TriangleAlert className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" block onClick={reset}>
          <RefreshCw className="size-4" aria-hidden />
          다시 시도
        </Button>
        <Button href="/" variant="outline" size="lg" block>
          처음 화면으로
        </Button>
      </div>
    </AuthShell>
  );
}
