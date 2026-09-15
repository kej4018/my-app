"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";

// 로그인·로그아웃 처리.
// 서버 액션은 proxy의 보호를 벗어날 수 있으므로, 인증이 필요한 액션을 새로 추가할 때는
// 반드시 함수 첫 줄에서 guard.ts의 requireUser()를 호출해야 한다.
// (아래 두 함수는 인증 자체를 수행하는 입구라 예외)

/** 외부 주소로 튕겨나가지 않도록 내부 경로인지 확인한다 */
function safeNextPath(value: unknown): string {
  const path = typeof value === "string" ? value : "";
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return "/";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent("이메일과 비밀번호를 입력해 주세요.")}&next=${encodeURIComponent(next)}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 어떤 계정이 존재하는지 알려주지 않기 위해 사유를 구분하지 않는다
    redirect(
      `/login?error=${encodeURIComponent("이메일 또는 비밀번호가 올바르지 않습니다.")}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
