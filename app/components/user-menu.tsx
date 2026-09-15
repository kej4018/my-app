import { signOut } from "@/app/login/actions";
import type { SessionUser } from "@/app/lib/auth/guard";

// 헤더 오른쪽에 로그인한 사용자와 역할을 표시하고 로그아웃 버튼을 제공한다
export default function UserMenu({ user }: { user: SessionUser }) {
  const isAdmin = user.role === "admin";

  return (
    <div className="ml-auto flex items-center gap-3 text-sm">
      <span className="hidden text-slate-600 sm:inline dark:text-slate-300">
        {user.email}
      </span>
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium ${
          isAdmin
            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        {isAdmin ? "관리자" : "채용담당자"}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
