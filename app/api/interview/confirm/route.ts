import { requireApiUser } from "@/app/lib/auth/guard";
import { coordinate } from "@/app/lib/interview";
import { getInterview, saveInterview } from "@/app/lib/store";

// 담당자 최종 승인으로 면접 일정을 확정하는 API

export async function POST(request: Request) {
  const gate = await requireApiUser();
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => null);

  const id = typeof body?.id === "string" ? body.id : "";
  const slot = typeof body?.slot === "string" ? body.slot : "";

  const target = getInterview(id);
  if (!target) {
    return Response.json({ error: "조율 요청을 찾을 수 없습니다." }, { status: 404 });
  }

  // 담당자가 고른 시간대가 실제로 양쪽 모두 가능한 시간인지 다시 확인한다
  const { suggestions } = coordinate(target.applicantSlots, target.managerSlots);
  if (!suggestions.includes(slot)) {
    return Response.json(
      { error: "양쪽 모두 가능한 시간대가 아닙니다." },
      { status: 400 },
    );
  }

  const confirmed = {
    ...target,
    status: "확정" as const,
    confirmedSlot: slot,
    note: undefined,
  };
  saveInterview(confirmed);

  return Response.json({ request: confirmed });
}
