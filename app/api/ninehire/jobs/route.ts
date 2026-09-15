import { requireApiAdmin } from "@/app/lib/auth/guard";
import { fetchAllJobs } from "@/app/lib/ninehire";

// 나인하이어 채용 공고 조회 API (서버에서만 API 키를 사용한다)

export async function GET() {
  // 연동 설정을 다루는 관리 기능이므로 관리자만 허용한다
  const gate = await requireApiAdmin();
  if (!gate.ok) return gate.response;

  const result = await fetchAllJobs();

  if (!result.ok) {
    const status = result.reason === "no-key" ? 503 : 502;
    return Response.json({ error: result.message, reason: result.reason }, { status });
  }

  return Response.json({ jobs: result.data });
}
