import { requireApiUser } from "@/app/lib/auth/guard";
import { coordinate } from "@/app/lib/interview";
import { getPosition, saveInterview } from "@/app/lib/store";
import type { InterviewRequest } from "@/app/lib/types";

// 면접 일정 조율 실행 API (새 조율 요청 생성)

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request) {
  const gate = await requireApiUser();
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => null);

  const applicantName =
    typeof body?.applicantName === "string" ? body.applicantName.trim() : "";
  const positionId = typeof body?.positionId === "string" ? body.positionId : "";
  const applicantSlots = toStringArray(body?.applicantSlots);
  const managerSlots = toStringArray(body?.managerSlots);

  if (!applicantName) {
    return Response.json({ error: "지원자 이름을 입력해 주세요." }, { status: 400 });
  }

  const position = getPosition(positionId);
  if (!position) {
    return Response.json({ error: "포지션을 찾을 수 없습니다." }, { status: 400 });
  }

  const result = coordinate(applicantSlots, managerSlots);

  const created: InterviewRequest = {
    id: `i${Date.now()}`,
    applicantName,
    positionId: position.id,
    applicantSlots,
    managerSlots,
    requestedAt: new Date().toISOString(),
    status: result.status,
    note: result.status === "담당자확인필요" ? result.message : undefined,
  };

  saveInterview(created);

  return Response.json({ request: created, result });
}
