import { requireUser } from "../lib/auth/guard";
import { positions } from "../lib/store";
import ScreeningClient from "./screening-client";

// 로그인 상태에 따라 화면이 달라지므로 캐시하지 않는다.
// (캐시된 응답에 갱신된 세션 쿠키가 실려 다른 사용자에게 전달되는 것을 막는다)
export const dynamic = "force-dynamic";

export default async function ScreeningPage() {
  await requireUser("/screening");
  return <ScreeningClient positions={positions} />;
}
