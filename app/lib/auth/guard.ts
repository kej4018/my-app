import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";

// 페이지와 API 라우트가 똑같이 사용하는 권한 확인 모듈.
// 화면에서 메뉴를 숨기는 것은 편의일 뿐이고, 실제 차단은 항상 여기를 거친다.
// 이 파일은 서버에서만 import 한다.

export type AppRole = "admin" | "user";

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole;
};

/** 역할 값이 없거나 예상 밖이면 권한이 낮은 "user"로 처리한다 (안전한 기본값) */
function toRole(value: unknown): AppRole {
  return value === "admin" ? "admin" : "user";
}

type Claims = {
  sub?: string;
  email?: string;
  app_metadata?: { role?: unknown };
};

/**
 * JWT 클레임에서 로그인 사용자를 읽는다. 토큰 자체를 검증하므로 DB 조회가 없다.
 * 쿠키의 세션을 그대로 믿는 getSession()은 위조가 가능하므로 사용하지 않는다.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  const claims = data?.claims as Claims | undefined;
  if (error || !claims?.sub) return null;

  return {
    id: claims.sub,
    email: claims.email ?? "",
    role: toRole(claims.app_metadata?.role),
  };
}

/**
 * 인증 서버에 직접 확인한다(네트워크 1회).
 * getClaims()는 토큰 만료 전까지 "강제 로그아웃"을 알아채지 못하므로,
 * 가장 민감한 기능에서는 이 함수로 한 번 더 확인한다.
 */
async function getVerifiedSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    role: toRole((data.user.app_metadata as { role?: unknown } | null)?.role),
  };
}

// ── 페이지용 (실패 시 이동) ────────────────────────────────

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

export async function requireAdmin(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (user.role !== "admin") {
    redirect("/?denied=1");
  }
  return user;
}

// ── API 라우트용 (실패 시 응답 반환) ───────────────────────

export type Gate =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

type GateOptions = {
  /** true면 인증 서버에 직접 확인한다. 민감한 기능에만 사용 */
  strict?: boolean;
};

export async function requireApiUser(options?: GateOptions): Promise<Gate> {
  const user = options?.strict ? await getVerifiedSessionUser() : await getSessionUser();

  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export async function requireApiAdmin(options?: GateOptions): Promise<Gate> {
  const gate = await requireApiUser(options);
  if (!gate.ok) return gate;

  if (gate.user.role !== "admin") {
    return {
      ok: false,
      response: Response.json(
        { error: "관리자만 사용할 수 있는 기능입니다." },
        { status: 403 },
      ),
    };
  }
  return gate;
}
