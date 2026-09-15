import { requireApiUser } from "@/app/lib/auth/guard";
import { extractPdfTables, extractPdfText, fileToBuffer } from "@/app/lib/offer/pdfText";
import {
  parseHealthInsuranceCareers,
  parseHealthInsuranceCareersFromTables,
} from "@/app/lib/offer/parseHealthInsurance";
import { flagUnusualMonths, parsePayslip } from "@/app/lib/offer/parsePayslip";
import { parseResume } from "@/app/lib/offer/parseResume";
import type { OfferDraft } from "@/app/lib/offer/types";

// 이력서·건강보험자격득실확인서·급여명세서(PDF)를 업로드받아 처우산정 초안을 만든다.
// 업로드된 파일은 이 요청을 처리하는 동안만 메모리에 존재하며, 응답을 반환한 뒤 disk/store에
// 저장하지 않는다 (요청이 끝나면 Buffer 참조가 사라짐).
//
// 표 형태 문서(건강보험확인서·급여명세서)는 선으로 그려진 표를 먼저 인식해서 읽고,
// 표를 못 찾거나 표에서 값을 못 얻으면 줄바꿈 기반 텍스트 방식으로 보완한다.

const DEFAULT_MEAL_ALLOWANCE = 200000;
const MIN_MEANINGFUL_TEXT_LENGTH = 20;

export async function POST(request: Request) {
  // 지원자 서류 원문을 다루므로 인증 서버에 직접 확인하고(strict),
  // 파일을 메모리에 올리기 전에 먼저 막는다
  const gate = await requireApiUser({ strict: true });
  if (!gate.ok) return gate.response;

  const form = await request.formData();

  const resumeFile = form.get("resume");
  const healthInsuranceFile = form.get("healthInsurance");
  const payslipFiles = form.getAll("payslips");

  if (!(resumeFile instanceof File) || !(healthInsuranceFile instanceof File)) {
    return Response.json(
      { error: "이력서와 건강보험 자격득실확인서 파일을 모두 첨부해 주세요." },
      { status: 400 },
    );
  }
  if (payslipFiles.length === 0) {
    return Response.json({ error: "급여명세서를 1개 이상 첨부해 주세요." }, { status: 400 });
  }

  try {
    const resumeBuffer = await fileToBuffer(resumeFile);
    const healthInsuranceBuffer = await fileToBuffer(healthInsuranceFile);

    const [resumeText, healthInsuranceText, healthInsuranceTables] = await Promise.all([
      extractPdfText(resumeBuffer),
      extractPdfText(healthInsuranceBuffer),
      extractPdfTables(healthInsuranceBuffer),
    ]);

    const payslipDebug: { text: string; tables: string[][][] }[] = [];
    const payslipMonths = await Promise.all(
      payslipFiles.map(async (file, index) => {
        if (!(file instanceof File)) {
          throw new Error("급여명세서 파일이 올바르지 않습니다.");
        }
        const buffer = await fileToBuffer(file);
        const [text, tables] = await Promise.all([
          extractPdfText(buffer),
          extractPdfTables(buffer),
        ]);
        payslipDebug[index] = { text, tables };
        return parsePayslip(text, `첨부 ${index + 1}`, tables);
      }),
    );

    const resume = parseResume(resumeText);

    const tableCareers = parseHealthInsuranceCareersFromTables(healthInsuranceTables);
    const careers =
      tableCareers.length > 0 ? tableCareers : parseHealthInsuranceCareers(healthInsuranceText);

    const payslips = flagUnusualMonths(
      payslipMonths.sort((a, b) => a.month.localeCompare(b.month)),
    );

    const warnings: string[] = [];
    if (resumeText.trim().length < MIN_MEANINGFUL_TEXT_LENGTH) {
      warnings.push(
        "이력서 PDF에서 텍스트를 거의 읽지 못했습니다. 스캔본(이미지)으로 저장된 PDF일 수 있습니다.",
      );
    }
    if (healthInsuranceText.trim().length < MIN_MEANINGFUL_TEXT_LENGTH) {
      warnings.push(
        "건강보험 자격득실확인서 PDF에서 텍스트를 거의 읽지 못했습니다. 스캔본(이미지)으로 저장된 PDF일 수 있습니다.",
      );
    }
    if (payslips.every((month) => month.items.length === 0)) {
      warnings.push(
        "급여명세서에서 지급항목을 하나도 인식하지 못했습니다. 스캔본이거나 표 형식이 달라서일 수 있습니다.",
      );
    }

    const draft: OfferDraft = {
      resume,
      careers,
      assignedDept: "",
      grade: "",
      title: "팀원",
      employmentType: "정규직",
      payType: "연봉제(포괄임금제)",
      joinDate: "",
      payslips,
      companyMealAllowanceMonthly: DEFAULT_MEAL_ALLOWANCE,
      desiredAnnual: null,
      finalOfferAnnual: null,
      benchmarkPeers: [],
    };

    // 자동 인식이 실패했을 때 담당자가 브라우저에서 직접 원인을 확인할 수 있도록
    // 추출된 원본 텍스트·표 인식 결과를 함께 내려준다 (서버 로그에는 남기지 않는다).
    return Response.json({
      draft,
      warnings,
      debugText: {
        resume: resumeText,
        healthInsurance: healthInsuranceText,
        healthInsuranceTables,
        payslips: payslipDebug,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서류 분석 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
