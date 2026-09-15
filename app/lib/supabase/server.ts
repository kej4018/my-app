import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 서버(서버 컴포넌트·서버 액션·라우트 핸들러)에서 사용하는 Supabase 클라이언트.
// 이 파일은 서버에서만 import 한다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 proxy.ts가 담당하므로 여기서는 무시해도 된다.
          }
        },
      },
    },
  );
}
