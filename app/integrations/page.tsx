import { requireAdmin } from "../lib/auth/guard";
import { hasApiKey } from "../lib/ninehire";
import IntegrationsClient from "./integrations-client";

// 환경변수 설정 여부와 로그인 상태를 매 요청마다 확인한다
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  // 연동 설정·API 키 상태를 다루는 관리 화면이므로 관리자만 접근할 수 있다
  await requireAdmin("/integrations");

  // 키의 설정 여부(boolean)만 클라이언트로 전달하고 값 자체는 전달하지 않는다
  return <IntegrationsClient keyConfigured={hasApiKey()} />;
}
