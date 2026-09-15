import { requireApiUser } from "@/app/lib/auth/guard";
import { buildOfferWorkbook } from "@/app/lib/offer/buildWorkbook";
import type { OfferDraft } from "@/app/lib/offer/types";

// 화면에서 담당자가 검토·확정한 처우산정 내용을 엑셀(.xlsx)로 생성해 내려준다.
// 서버에는 아무것도 저장하지 않고, 요청 → 파일 생성 → 응답만 수행한다.

export async function POST(request: Request) {
  const gate = await requireApiUser();
  if (!gate.ok) return gate.response;

  const draft = (await request.json().catch(() => null)) as OfferDraft | null;

  if (!draft || !draft.resume?.name) {
    return Response.json({ error: "처우산정 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const workbook = buildOfferWorkbook(draft);
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${draft.resume.name || "지원자"}_처우산정.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
