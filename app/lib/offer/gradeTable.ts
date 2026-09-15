import type { GradeRule } from "./types";

// 제이시스메디칼 사내 직급 기준표 (회사 정책 상수 - 개인정보 아님)
// 총 경력 연수를 기준으로 어느 직급부터 시작하는지 정의한다.
export const GRADE_TABLE: GradeRule[] = [
  { grade: "L1", position: "고졸", baseCareerYears: 2 },
  { grade: "L2", position: "초대졸", baseCareerYears: 2 },
  { grade: "L3", position: "사원", baseCareerYears: 3 },
  { grade: "L4", position: "대리", baseCareerYears: 4 },
  { grade: "L5", position: "과장", baseCareerYears: 4 },
  { grade: "L6", position: "차장", baseCareerYears: 5 },
  { grade: "L7", position: "부장", baseCareerYears: 5 },
];

/** 총 경력 연수로 적용 가능한 가장 높은 직급을 추천한다 (담당자가 최종 선택) */
export function suggestGrade(totalCareerYears: number): GradeRule {
  const eligible = GRADE_TABLE.filter((rule) => totalCareerYears >= rule.baseCareerYears);
  return eligible.at(-1) ?? GRADE_TABLE[0];
}

/** 선택된 직급 안에서 몇 년차인지 계산한다 (처우산정 시트의 "직급 연차" 수식과 동일 로직) */
export function calcGradeStep(grade: string, totalCareerYears: number): string {
  const rule = GRADE_TABLE.find((item) => item.grade === grade);
  if (!rule) return "-";
  const step = Math.max(1, Math.floor(totalCareerYears - rule.baseCareerYears) + 1);
  return `${rule.position} ${step}년차`;
}
