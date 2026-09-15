import type { Metadata } from "next";
import Link from "next/link";
import UserMenu from "./components/user-menu";
import { getSessionUser, type AppRole } from "./lib/auth/guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR 리크루팅 봇",
  description: "제이시스메디칼 채용팀 업무 지원 도구 (PoC)",
};

// roles에 없는 역할에게는 메뉴를 감춘다.
// 메뉴 숨김은 편의일 뿐이며 실제 차단은 각 페이지·API의 가드가 담당한다.
const navItems: { href: string; label: string; roles: AppRole[] }[] = [
  { href: "/", label: "대시보드", roles: ["admin", "user"] },
  { href: "/screening", label: "이력서 스크리닝", roles: ["admin", "user"] },
  { href: "/interview", label: "면접 일정 조율", roles: ["admin", "user"] },
  { href: "/offer", label: "처우안 산정", roles: ["admin", "user"] },
  { href: "/integrations", label: "ATS 연동", roles: ["admin"] },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  const visibleNavItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
            <Link href="/" className="text-lg font-bold">
              HR 리크루팅 봇
              <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                PoC
              </span>
            </Link>
            <nav className="flex gap-4 text-sm">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {user && <UserMenu user={user} />}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
        <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          최종 합격·불합격 판단은 반드시 채용담당자가 결정합니다. (PRD 5) AI가 지킬 규칙)
        </footer>
      </body>
    </html>
  );
}
