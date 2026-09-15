import { calcGradeStep, suggestGrade } from "./gradeTable";
import type { OfferComputed, OfferDraft } from "./types";

// 처우산정 시트의 수식들을 그대로 옮긴 계산 로직.
// "희망연봉/최종 제안연봉/직급 최종 선택/경력 인정 여부/급여 반영 여부"는
// 담당자 판단 영역이므로 여기서 확정하지 않고, 담당자가 입력·수정한 값을 그대로 계산에 반영한다.

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function computeOffer(draft: OfferDraft): OfferComputed {
  const recognizedCareers = draft.careers.filter((career) => career.recognized);
  const totalRecognizedDays = recognizedCareers.reduce(
    (sum, career) => sum + career.workDays,
    0,
  );
  const totalCareerYears = totalRecognizedDays > 0 ? Math.floor(totalRecognizedDays / 365) + 1 : 0;

  const suggested = suggestGrade(totalCareerYears);
  const grade = draft.grade || suggested.grade;
  const gradeStep = calcGradeStep(grade, totalCareerYears);

  const includedMonths = draft.payslips.filter((month) => month.include);
  const averageMonthlyPay = average(includedMonths.map((month) => month.total));

  const currentAnnualIncludingMeal =
    (averageMonthlyPay + draft.companyMealAllowanceMonthly) * 12;
  const currentAnnualExcludingMeal = averageMonthlyPay * 12;

  const desiredIncreaseRate =
    draft.desiredAnnual && currentAnnualIncludingMeal > 0
      ? draft.desiredAnnual / currentAnnualIncludingMeal - 1
      : null;
  const finalIncreaseRate =
    draft.finalOfferAnnual && currentAnnualIncludingMeal > 0
      ? draft.finalOfferAnnual / currentAnnualIncludingMeal - 1
      : null;

  const benchmarkAverageExcludingMeal =
    draft.benchmarkPeers.length > 0
      ? average(draft.benchmarkPeers.map((peer) => peer.annualExcludingMeal))
      : null;
  const benchmarkAverageIncludingMeal =
    draft.benchmarkPeers.length > 0
      ? average(draft.benchmarkPeers.map((peer) => peer.annualIncludingMeal))
      : null;

  return {
    totalRecognizedDays,
    totalCareerYears,
    suggestedGrade: suggested.grade,
    gradeStep,
    averageMonthlyPay,
    currentAnnualIncludingMeal,
    currentAnnualExcludingMeal,
    desiredIncreaseRate,
    finalIncreaseRate,
    benchmarkAverageExcludingMeal,
    benchmarkAverageIncludingMeal,
  };
}
