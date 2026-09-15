// HR 리크루팅 봇 PoC에서 사용하는 공통 타입 정의

/** 채용 포지션과 HR이 사전 설정한 필수 자격요건 */
export type Position = {
  id: string;
  title: string;
  department: string;
  /** 최소 경력 연차 (신입은 0) */
  minYears: number;
  /** 필수 자격요건 키워드 (자격증·전공·필수 경험) */
  requiredKeywords: string[];
  /** 우대 키워드 (판정에는 영향을 주지 않음) */
  preferredKeywords: string[];
};

/** 개별 기준의 판정 상태 */
export type CriterionStatus = "충족" | "미충족" | "모호";

export type CriterionResult = {
  label: string;
  status: CriterionStatus;
  detail: string;
};

/** 스크리닝 최종 분류 (합격/불합격이 아닌 1차 분류값) */
export type ScreeningVerdict = "적합" | "확인필요" | "부적합";

export type ScreeningResult = {
  verdict: ScreeningVerdict;
  summary: string;
  criteria: CriterionResult[];
  preferredHits: string[];
};

export type ScreeningRecord = ScreeningResult & {
  id: string;
  positionId: string;
  applicantName: string;
  screenedAt: string;
};

/** 면접 일정 조율 상태 */
export type CoordinationStatus = "승인대기" | "담당자확인필요" | "확정";

export type InterviewRequest = {
  id: string;
  applicantName: string;
  positionId: string;
  /** 지원자가 제시한 가능 시간대 */
  applicantSlots: string[];
  /** 현업 면접관이 제시한 가능 시간대 */
  managerSlots: string[];
  /** 조율 요청을 보낸 시각 (48시간 무응답 알림 판단 기준) */
  requestedAt: string;
  status: CoordinationStatus;
  /** 담당자가 최종 승인한 시간대 */
  confirmedSlot?: string;
  /** 담당자 확인이 필요한 사유 */
  note?: string;
};

/** 조율 로직 실행 결과 */
export type CoordinationResult = {
  status: Exclude<CoordinationStatus, "확정">;
  message: string;
  /** 양쪽이 모두 가능한 시간대 (담당자 승인 대상) */
  suggestions: string[];
};

/** 수습평가 메일 대상자 */
export type NewHire = {
  id: string;
  name: string;
  department: string;
  /** 입사일 (YYYY-MM-DD) */
  joinedAt: string;
};

/** 수습평가 메일 발송 예정 정보 */
export type ProbationSchedule = {
  hire: NewHire;
  /** 45일 차 중간평가 예정일 */
  midDate: string;
  /** 80일 차 최종평가 예정일 */
  finalDate: string;
  /** 다음 발송 예정 안내 문구 */
  nextLabel: string;
  /** 다음 발송까지 남은 일수 (지난 경우 음수) */
  nextInDays: number;
};
