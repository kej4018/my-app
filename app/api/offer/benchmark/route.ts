import { requireApiAdmin } from "@/app/lib/auth/guard";
import { lookupDepartmentBenchmark } from "@/app/lib/offer/masterLookup";

// 인사마스터 파일에서 동일 소속 재직자 벤치마크만 조회한다.
// 업로드된 인사마스터 파일은 이 요청 처리 중에만 메모리에 존재하며 저장하지 않는다.
// 비밀번호도 응답에 포함하거나 로그로 남기지 않는다.

export async function POST(request: Request) {
  // 전 직원 급여와 주민번호·계좌번호가 담긴 파일을 다루므로 관리자만 허용하고,
  // 인증 서버에 직접 확인한다(strict). 파일을 메모리에 올리기 전에 먼저 막는다.
  const gate = await requireApiAdmin({ strict: true });
  if (!gate.ok) return gate.response;

  const form = await request.formData();

  const masterFile = form.get("masterFile");
  const password = form.get("password");
  const department = form.get("department");
  const mealAllowance = Number(form.get("mealAllowance") ?? 200000);

  if (!(masterFile instanceof File)) {
    return Response.json({ error: "인사마스터 파일을 첨부해 주세요." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length === 0) {
    return Response.json({ error: "인사마스터 파일 암호를 입력해 주세요." }, { status: 400 });
  }
  if (typeof department !== "string" || department.trim().length === 0) {
    return Response.json({ error: "소속(부서)을 먼저 입력해 주세요." }, { status: 400 });
  }

  const buffer = Buffer.from(await masterFile.arrayBuffer());
  const result = await lookupDepartmentBenchmark(buffer, password, department, mealAllowance);

  if (!result.ok) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  return Response.json({ peers: result.peers });
}
