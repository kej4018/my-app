import ExcelJS from "exceljs";
import { computeOffer } from "./calculate";
import type { OfferDraft } from "./types";

// 처우산정 결과로 "처우산정" · "채용품의" 두 시트짜리 엑셀을 새로 생성한다.
// 원본 사내 양식 파일을 직접 수정하지 않고 항상 새 워크북을 만든다.

function formatWon(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) return "";
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return "-";
  return `${(rate * 100).toFixed(1)}%`;
}

function calcAge(birthDate: string): string {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return `만 ${age}세`;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2E8F0" },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
}

export function buildOfferWorkbook(draft: OfferDraft): ExcelJS.Workbook {
  const computed = computeOffer(draft);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HR 리크루팅 봇 (PoC)";
  workbook.created = new Date();

  // ── 처우산정 시트 ─────────────────────────────────────────
  const offerSheet = workbook.addWorksheet("처우산정");
  offerSheet.columns = [
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  offerSheet.addRow(["신규 입사자 처우 산정(안)"]).font = { bold: true, size: 14 };
  offerSheet.addRow([
    `대상자: ${draft.resume.name}  |  희망 소속: ${draft.assignedDept || "(미정)"}`,
  ]);
  offerSheet.addRow([]);

  offerSheet.addRow(["1. 기본사항"]).font = { bold: true };
  styleHeaderRow(
    offerSheet.addRow(["성명", "생년월일", "연령", "최종학력", "자격증/어학", "직전 직장", "직전 직급"]),
  );
  offerSheet.addRow([
    draft.resume.name,
    draft.resume.birthDate,
    calcAge(draft.resume.birthDate),
    draft.resume.education,
    draft.resume.certificates,
    draft.resume.previousEmployer,
    draft.resume.previousTitle,
  ]);
  offerSheet.addRow([]);

  offerSheet.addRow(["2. 경력사항 (건강보험 자격득실확인서 기준)"]).font = { bold: true };
  styleHeaderRow(
    offerSheet.addRow(["No", "직장명", "자격 취득일", "자격 상실일", "근무일수", "경력 인정"]),
  );
  draft.careers.forEach((career, index) => {
    offerSheet.addRow([
      index + 1,
      career.employer,
      career.acquiredAt,
      career.lostAt || "재직중",
      career.workDays || "",
      career.recognized ? "인정" : "미인정",
    ]);
  });
  offerSheet.addRow(["경력 인정 합계", "", "", "", computed.totalRecognizedDays, `${computed.totalCareerYears}년차`]).font = {
    bold: true,
  };
  offerSheet.addRow([]);

  offerSheet.addRow(["3. 채용조건"]).font = { bold: true };
  styleHeaderRow(
    offerSheet.addRow([
      "소속",
      "직급",
      "직책",
      "근로형태",
      "급여유형",
      "산정 연차(총경력)",
      "직급 연차",
    ]),
  );
  offerSheet.addRow([
    draft.assignedDept,
    draft.grade || computed.suggestedGrade,
    draft.title,
    draft.employmentType,
    draft.payType,
    `${computed.totalCareerYears}년차`,
    computed.gradeStep,
  ]);
  offerSheet.addRow([]);

  offerSheet.addRow(["4. 현 처우 확인 (급여명세서 기준)"]).font = { bold: true };
  styleHeaderRow(offerSheet.addRow(["지급항목", ...draft.payslips.map((month) => month.month)]));
  const allLabels = Array.from(
    new Set(draft.payslips.flatMap((month) => month.items.map((item) => item.label))),
  );
  for (const label of allLabels) {
    offerSheet.addRow([
      label,
      ...draft.payslips.map((month) => month.items.find((item) => item.label === label)?.amount ?? ""),
    ]);
  }
  offerSheet.addRow(["지급액 계", ...draft.payslips.map((month) => month.total)]).font = {
    bold: true,
  };
  offerSheet.addRow(["산정 반영", ...draft.payslips.map((month) => (month.include ? "반영" : "제외"))]);
  offerSheet.addRow(["정상월 평균 지급액", computed.averageMonthlyPay]);
  offerSheet.addRow(["월 식대(사내 기준)", draft.companyMealAllowanceMonthly]);
  offerSheet.addRow(["현 연봉 (식대 포함)", computed.currentAnnualIncludingMeal]).font = {
    bold: true,
  };
  offerSheet.addRow(["현 연봉 (식대 제외)", computed.currentAnnualExcludingMeal]);
  offerSheet.addRow([]);

  offerSheet.addRow(["5. 처우 산정"]).font = { bold: true };
  styleHeaderRow(offerSheet.addRow(["구분", "금액(원)", "현 연봉 대비 인상률"]));
  offerSheet.addRow(["현 연봉 (식대 포함)", computed.currentAnnualIncludingMeal, "-"]);
  offerSheet.addRow([
    "희망연봉",
    draft.desiredAnnual ?? "",
    formatPercent(computed.desiredIncreaseRate),
  ]);
  offerSheet.addRow([
    "최종 제안연봉",
    draft.finalOfferAnnual ?? "",
    formatPercent(computed.finalIncreaseRate),
  ]).font = { bold: true };

  if (draft.benchmarkPeers.length > 0) {
    offerSheet.addRow([]);
    offerSheet
      .addRow([`※ 참고. 동일 소속 재직자 처우 현황 (재직 ${draft.benchmarkPeers.length}명)`])
      .font = { bold: true };
    styleHeaderRow(
      offerSheet.addRow(["성명", "부서/직급·직책/경력", "최종학력", "연봉(식대 제외)", "연봉(식대 포함)"]),
    );
    for (const peer of draft.benchmarkPeers) {
      offerSheet.addRow([
        peer.name,
        `${peer.department} / ${peer.grade}·${peer.title} / ${peer.careerYears}년`,
        peer.education,
        peer.annualExcludingMeal,
        peer.annualIncludingMeal,
      ]);
    }
    offerSheet.addRow([
      "평균",
      "",
      "",
      computed.benchmarkAverageExcludingMeal,
      computed.benchmarkAverageIncludingMeal,
    ]).font = { bold: true };
  }

  // ── 채용품의 시트 ─────────────────────────────────────────
  const proposalSheet = workbook.addWorksheet("채용품의");
  proposalSheet.columns = [{ width: 14 }, { width: 14 }, { width: 40 }, { width: 16 }];

  styleHeaderRow(proposalSheet.addRow(["구 분", "", "내 용", "비 고"]));
  proposalSheet.addRow(["성 명", "", draft.resume.name, ""]);
  proposalSheet.addRow(["채용조건", "근로형태", draft.employmentType, ""]);
  proposalSheet.addRow(["", "소 속", draft.assignedDept, ""]);
  proposalSheet.addRow(["", "직급", draft.grade || computed.suggestedGrade, ""]);
  proposalSheet.addRow(["", "직 책", draft.title, ""]);
  proposalSheet.addRow(["", "급여유형", draft.payType, ""]);
  proposalSheet.addRow([
    "",
    "계약연봉",
    formatWon(draft.finalOfferAnnual ?? computed.currentAnnualIncludingMeal),
    "식대포함",
  ]);
  proposalSheet.addRow(["", "입사일", draft.joinDate, ""]);
  proposalSheet.addRow([
    "인적사항",
    "생년/성별",
    draft.resume.birthDate
      ? `${draft.resume.birthDate.slice(0, 4)}년생(${calcAge(draft.resume.birthDate)})/${draft.resume.gender}`
      : "",
    "",
  ]);
  proposalSheet.addRow(["", "최종학력", draft.resume.education, ""]);
  proposalSheet.addRow([
    "경력사항",
    "",
    `경력 ${computed.totalCareerYears}년 (${draft.careers
      .filter((career) => career.recognized)
      .map((career) => career.employer)
      .join(", ")})`,
    computed.gradeStep,
  ]);
  proposalSheet.addRow(["담당업무", "", "", ""]);
  proposalSheet.addRow(["비 고", "", "", ""]);

  return workbook;
}
