import { redirect } from "next/navigation";
import { getSessionUser } from "@/app/lib/auth/guard";
import { signIn } from "./actions";

// 세션 상태에 따라 화면이 달라지므로 캐시하지 않는다
export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : "";
  const next = typeof params.next === "string" ? params.next : "/";

  // 이미 로그인한 상태면 바로 들여보낸다
  const user = await getSessionUser();
  if (user) redirect(next.startsWith("/") ? next : "/");

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
      <h1 className="text-2xl font-bold">로그인</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        제이시스메디칼 채용팀 전용 도구입니다. 지급받은 계정으로 로그인해 주세요.
      </p>

      <form
        action={signIn}
        className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <input type="hidden" name="next" value={next} />

        <label className="block text-sm">
          <span className="mb-1 block font-medium">이메일</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">비밀번호</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          로그인
        </button>

        {errorMessage && (
          <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {errorMessage}
          </p>
        )}
      </form>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        계정 발급이 필요하면 채용팀 관리자에게 문의해 주세요. 이 도구는 공개 가입을 받지
        않습니다.
      </p>
    </div>
  );
}
