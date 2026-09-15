import type { NextRequest } from "next/server";
import { updateSession } from "@/app/lib/supabase/proxy";

// Next.js 16부터 middleware가 proxy로 이름이 바뀌었다.
// 모든 요청에서 Supabase 세션을 갱신하고 미인증 접근을 막는다.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 정적 파일과 이미지 최적화 경로는 제외한다 (인증 로직이 CSS·JS·이미지를 막지 않도록)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
