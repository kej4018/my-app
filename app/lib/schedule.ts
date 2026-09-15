import type { NewHire, ProbationSchedule } from "./types";

// 날짜 계산 및 면접 가능 시간대 생성 유틸

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** 수습평가 메일 발송 기준일 (PRD 3) 45일 차 중간평가 / 80일 차 최종평가) */
export const MID_REVIEW_DAY = 45;
export const FINAL_REVIEW_DAY = 80;

export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateWithWeekday(date: Date): string {
  return `${formatDate(date)} (${WEEKDAY_LABELS[date.getDay()]})`;
}

/** 오늘 기준 평일 5일 × 3개 시간대의 면접 후보 슬롯을 만든다 */
export function buildSlotOptions(from = new Date()): string[] {
  const times = ["10:00", "14:00", "16:00"];
  const slots: string[] = [];
  let cursor = addDays(from, 1);

  while (slots.length < times.length * 5) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) {
      for (const time of times) {
        slots.push(`${formatDateWithWeekday(cursor)} ${time}`);
      }
    }
    cursor = addDays(cursor, 1);
  }

  return slots;
}

function diffInDays(target: Date, now: Date): number {
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(
    (startOfTarget.getTime() - startOfNow.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/** 입사일을 기준으로 45일 차·80일 차 평가 메일 발송 예정일을 계산한다 */
export function buildProbationSchedule(
  hire: NewHire,
  now = new Date(),
): ProbationSchedule {
  const joined = new Date(hire.joinedAt);
  const mid = addDays(joined, MID_REVIEW_DAY);
  const final = addDays(joined, FINAL_REVIEW_DAY);

  const midDiff = diffInDays(mid, now);
  const finalDiff = diffInDays(final, now);

  const upcoming =
    midDiff >= 0
      ? { label: "45일 차 중간평가", diff: midDiff }
      : finalDiff >= 0
        ? { label: "80일 차 최종평가", diff: finalDiff }
        : { label: "수습평가 완료", diff: finalDiff };

  return {
    hire,
    midDate: formatDate(mid),
    finalDate: formatDate(final),
    nextLabel: upcoming.label,
    nextInDays: upcoming.diff,
  };
}
