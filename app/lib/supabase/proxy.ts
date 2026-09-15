import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 모든 요청마다 세션 쿠키를 갱신하고, 로그인하지 않은 접근을 /login으로 돌려보낸다.
// 로그인 화면과 인증 처리 경로는 예외로 둔다.
const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // 캐시 관련 헤더를 응답에 그대로 반영해야 CDN이 응답을 캐시해
          // 다른 사용자에게 세션이 새어 나가는 일을 막을 수 있다.
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // createServerClient와 getClaims() 사이에 다른 코드를 넣지 않는다.
  // (세션이 무작위로 끊기는 문제의 흔한 원인)
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!claims && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // 로그인 후 원래 가려던 화면으로 돌아오게 한다
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  // supabaseResponse를 그대로 반환해야 갱신된 쿠키가 유지된다.
  return supabaseResponse;
}
