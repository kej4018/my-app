import { buildSlotOptions } from "./schedule";
import type {
  InterviewRequest,
  NewHire,
  Position,
  ScreeningRecord,
  ScreeningResult,
} from "./types";

// PoC용 메모리 저장소. 실제 DB는 도입 전이며 서버 재시작 시 초기화된다.

export const positions: Position[] = [
  {
    id: "ra",
    title: "의료기기 인허가(RA) 담당",
    department: "품질경영팀",
    minYears: 3,
    requiredKeywords: ["의료기기", "인허가", "GMP"],
    preferredKeywords: ["MDR", "FDA", "MFDS"],
  },
  {
    id: "sales",
    title: "해외영업 담당",
    department: "글로벌영업팀",
    minYears: 5,
    requiredKeywords: ["해외영업", "영어"],
    preferredKeywords: ["의료기기", "디스트리뷰터", "에스테틱"],
  },
  {
    id: "production",
    title: "생산기술 엔지니어",
    department: "생산기술팀",
    minYears: 2,
    requiredKeywords: ["생산기술", "공정개선"],
    preferredKeywords: ["레이저", "자동화", "설비"],
  },
];

export const newHires: NewHire[] = [
  { id: "h1", name: "정하늘", department: "품질경영팀", joinedAt: "2026-08-01" },
  { id: "h2", name: "오세훈", department: "생산기술팀", joinedAt: "2026-07-10" },
  { id: "h3", name: "한지민", department: "글로벌영업팀", joinedAt: "2026-09-01" },
];

type Store = {
  screenings: ScreeningRecord[];
  interviews: InterviewRequest[];
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function createInitialStore(): Store {
  const slots = buildSlotOptions();

  return {
    screenings: [
      {
        id: "s1",
        positionId: "ra",
        applicantName: "김서연",
        verdict: "적합",
        summary: "필수 자격요건을 모두 충족합니다. 서류합격 여부는 담당자가 결정합니다.",
        criteria: [],
        preferredHits: ["MFDS"],
        screenedAt: hoursAgo(30),
      },
      {
        id: "s2",
        positionId: "ra",
        applicantName: "박도현",
        verdict: "확인필요",
        summary: "판단이 애매한 항목이 1건 있어 담당자 검토가 필요합니다.",
        criteria: [],
        preferredHits: [],
        screenedAt: hoursAgo(26),
      },
      {
        id: "s3",
        positionId: "sales",
        applicantName: "이채린",
        verdict: "부적합",
        summary: "필수 자격요건 1건을 충족하지 못했습니다.",
        criteria: [],
        preferredHits: [],
        screenedAt: hoursAgo(20),
      },
      {
        id: "s4",
        positionId: "production",
        applicantName: "최우진",
        verdict: "적합",
        summary: "필수 자격요건을 모두 충족합니다. 서류합격 여부는 담당자가 결정합니다.",
        criteria: [],
        preferredHits: ["레이저"],
        screenedAt: hoursAgo(8),
      },
    ],
    interviews: [
      {
        id: "i1",
        applicantName: "김서연",
        positionId: "ra",
        applicantSlots: [slots[0], slots[3], slots[4], slots[7]],
        managerSlots: [slots[3], slots[4], slots[8], slots[9]],
        requestedAt: hoursAgo(5),
        status: "승인대기",
      },
      {
        id: "i2",
        applicantName: "최우진",
        positionId: "production",
        applicantSlots: [slots[1], slots[6]],
        managerSlots: [slots[1], slots[6], slots[10], slots[11]],
        requestedAt: hoursAgo(12),
        status: "담당자확인필요",
        note: "지원자가 제시한 가능 시간대가 2개로 최소 3개에 미달합니다.",
      },
      {
        id: "i3",
        applicantName: "박도현",
        positionId: "ra",
        applicantSlots: [slots[2], slots[5], slots[8]],
        managerSlots: [slots[2], slots[5], slots[9]],
        requestedAt: hoursAgo(55),
        status: "승인대기",
      },
    ],
  };
}

// 개발 중 핫 리로드로 데이터가 초기화되지 않도록 전역 객체에 보관한다
const globalStore = globalThis as unknown as { __hrBotStore?: Store };

function getStore(): Store {
  if (!globalStore.__hrBotStore) {
    globalStore.__hrBotStore = createInitialStore();
  }
  return globalStore.__hrBotStore;
}

export function getPosition(positionId: string): Position | undefined {
  return positions.find((position) => position.id === positionId);
}

export function listScreenings(): ScreeningRecord[] {
  return [...getStore().screenings].sort((a, b) =>
    b.screenedAt.localeCompare(a.screenedAt),
  );
}

export function addScreening(
  positionId: string,
  applicantName: string,
  result: ScreeningResult,
): ScreeningRecord {
  const record: ScreeningRecord = {
    ...result,
    id: `s${Date.now()}`,
    positionId,
    applicantName,
    screenedAt: new Date().toISOString(),
  };
  getStore().screenings.push(record);
  return record;
}

export function listInterviews(): InterviewRequest[] {
  return [...getStore().interviews].sort((a, b) =>
    a.requestedAt.localeCompare(b.requestedAt),
  );
}

export function getInterview(id: string): InterviewRequest | undefined {
  return getStore().interviews.find((request) => request.id === id);
}

export function saveInterview(request: InterviewRequest): void {
  const store = getStore();
  const index = store.interviews.findIndex((item) => item.id === request.id);
  if (index >= 0) {
    store.interviews[index] = request;
  } else {
    store.interviews.push(request);
  }
}
