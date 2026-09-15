import { requireApiUser } from "@/app/lib/auth/guard";
import { screenResume } from "@/app/lib/screening";
import { addScreening, getPosition } from "@/app/lib/store";

// 이력서 1차 스크리닝 실행 API

export async function POST(request: Request) {
  const gate = await requireApiUser();
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => null);

  const positionId = typeof body?.positionId === "string" ? body.positionId : "";
  const applicantName =
    typeof body?.applicantName === "string" ? body.applicantName.trim() : "";
  const resumeText = typeof body?.resumeText === "string" ? body.resumeText : "";

  if (!applicantName) {
    return Response.json({ error: "지원자 이름을 입력해 주세요." }, { status: 400 });
  }

  if (resumeText.trim().length < 10) {
    return Response.json(
      { error: "이력서 내용을 10자 이상 입력해 주세요." },
      { status: 400 },
    );
  }

  const position = getPosition(positionId);
  if (!position) {
    return Response.json({ error: "포지션을 찾을 수 없습니다." }, { status: 400 });
  }

  const result = screenResume(position, resumeText);
  const record = addScreening(position.id, applicantName, result);

  return Response.json({ record });
}
