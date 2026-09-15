import type { CoordinationResult, InterviewRequest } from "./types";

// PRD 5) Must 2 - 면접 일정 조율 규칙
// 양쪽에서 각각 최소 3개 이상의 가능 시간대를 받기 전에는 자동 조율을 진행하지 않고,
// 겹치는 시간이 있어도 담당자 승인 전에는 확정하지 않는다.

/** 자동 조율을 시작하기 위해 양쪽에 요구하는 최소 가능 시간대 수 */
export const MIN_SLOTS = 3;

/** 회신이 없을 때 담당자에게 알림을 보내는 기준 시간 */
export const RESPONSE_DEADLINE_HOURS = 48;

export function coordinate(
  applicantSlots: string[],
  managerSlots: string[],
): CoordinationResult {
  const applicant = applicantSlots.filter((slot) => slot.trim().length > 0);
  const manager = managerSlots.filter((slot) => slot.trim().length > 0);

  if (applicant.length < MIN_SLOTS || manager.length < MIN_SLOTS) {
    const shortages: string[] = [];
    if (applicant.length < MIN_SLOTS) {
      shortages.push(`지원자 ${applicant.length}개`);
    }
    if (manager.length < MIN_SLOTS) {
      shortages.push(`현업 ${manager.length}개`);
    }
    return {
      status: "담당자확인필요",
      message: `가능 시간대가 최소 ${MIN_SLOTS}개에 미달합니다 (${shortages.join(", ")}). 자동 조율을 중단하고 담당자가 직접 조율합니다.`,
      suggestions: [],
    };
  }

  const managerSet = new Set(manager);
  const suggestions = applicant.filter((slot) => managerSet.has(slot));

  if (suggestions.length === 0) {
    return {
      status: "담당자확인필요",
      message:
        "양쪽 모두 가능한 시간대가 없습니다. 담당자가 직접 일정을 재조율해야 합니다.",
      suggestions: [],
    };
  }

  return {
    status: "승인대기",
    message: `양쪽 모두 가능한 시간대 ${suggestions.length}개를 찾았습니다. 담당자 승인 후 확정됩니다.`,
    suggestions,
  };
}

/** 조율 요청 후 48시간이 지났는지 판단한다 */
export function isOverdue(request: InterviewRequest, now = new Date()): boolean {
  if (request.status === "확정") return false;
  const elapsedHours =
    (now.getTime() - new Date(request.requestedAt).getTime()) / (1000 * 60 * 60);
  return elapsedHours >= RESPONSE_DEADLINE_HOURS;
}

/** 조율 요청 후 경과 시간을 사람이 읽기 쉬운 문구로 변환한다 */
export function elapsedLabel(request: InterviewRequest, now = new Date()): string {
  const elapsedHours = Math.floor(
    (now.getTime() - new Date(request.requestedAt).getTime()) / (1000 * 60 * 60),
  );
  if (elapsedHours < 1) return "방금 요청";
  if (elapsedHours < 24) return `${elapsedHours}시간 경과`;
  return `${Math.floor(elapsedHours / 24)}일 경과`;
}
