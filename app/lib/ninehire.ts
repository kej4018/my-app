// 나인하이어(ATS) 읽기 전용 API 클라이언트
// 이 파일은 서버(라우트 핸들러·서버 컴포넌트)에서만 import 한다.
// NINEHIRE_API_KEY는 NEXT_PUBLIC_ 접두사가 없어 클라이언트 번들에 포함되지 않는다. (PRD 7 보안 규칙)

const BASE_URL = "https://api.ninehire.com/api/v1";

/** 한 번에 요청할 공고 수와 전체 조회 시 허용할 최대 페이지 수 */
const PAGE_SIZE = 50;
const MAX_PAGES = 10;

export type NinehireResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no-key" | "auth" | "http" | "network"; message: string };

export function hasApiKey(): boolean {
  return Boolean(process.env.NINEHIRE_API_KEY?.trim());
}

async function request<T>(path: string): Promise<NinehireResult<T>> {
  const apiKey = process.env.NINEHIRE_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      reason: "no-key",
      message:
        "NINEHIRE_API_KEY가 설정되지 않았습니다. .env 파일에 키를 추가한 뒤 서버를 재시작해 주세요.",
    };
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: "auth",
        message:
          "인증에 실패했습니다. 나인하이어에서 발급한 API 키가 올바른지 확인해 주세요.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: "http",
        message: `나인하이어 API가 ${response.status} 응답을 반환했습니다.`,
      };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch {
    // 실패 원인에 API 키가 섞여 나가지 않도록 원본 오류는 그대로 노출하지 않는다
    return {
      ok: false,
      reason: "network",
      message: "나인하이어 API에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.",
    };
  }
}

/** 나인하이어 /jobs 응답의 공고 객체 (실제 응답 기준) */
type RawJob = {
  id: string;
  title: string;
  status: string;
  applyUrl: string | null;
  deadline: string | null;
  deadlineType: string | null;
  tags: string[] | null;
  career: string | null;
  careerRange: { min?: number; max?: number } | null;
  employmentTypes: string[] | null;
  jobLocations: { name?: string; address?: string }[] | null;
  jobGroup: string | null;
  jobTask: string | null;
  affiliation: string | null;
  createdAt: string;
  isPrivate: boolean;
};

type JobsResponse = {
  count: number;
  results: RawJob[];
};

// 나인하이어가 내려주는 코드값을 화면용 한글 라벨로 바꾼다 (모르는 코드는 원본을 그대로 쓴다)
const STATUS_LABELS: Record<string, string> = {
  in_progress: "진행중",
  closed: "마감",
  scheduled: "예정",
  draft: "작성중",
};

const CAREER_LABELS: Record<string, string> = {
  irrelevant: "경력무관",
  newcomer: "신입",
  new: "신입",
  experienced: "경력",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "정규직",
  contractor: "계약직",
  intern: "인턴",
  part_time: "파트타임",
  dispatch: "파견직",
  freelancer: "프리랜서",
};

function label(source: Record<string, string>, code: string | null): string | null {
  if (!code) return null;
  return source[code] ?? code;
}

/** 화면 표시용으로 정리한 채용 공고 */
export type NinehireJob = {
  id: string;
  title: string;
  status: string;
  statusCode: string;
  affiliation: string | null;
  jobGroup: string | null;
  jobTask: string | null;
  career: string | null;
  employmentTypes: string[];
  location: string | null;
  deadline: string | null;
  applyUrl: string | null;
  isPrivate: boolean;
};

function formatDeadline(job: RawJob): string | null {
  if (job.deadlineType === "until_hired") return "채용 시 마감";
  if (!job.deadline) return null;
  return job.deadline.slice(0, 10);
}

function toJob(raw: RawJob): NinehireJob {
  return {
    id: raw.id,
    title: raw.title,
    status: label(STATUS_LABELS, raw.status) ?? raw.status,
    statusCode: raw.status,
    affiliation: raw.affiliation,
    jobGroup: raw.jobGroup,
    jobTask: raw.jobTask,
    career: label(CAREER_LABELS, raw.career),
    employmentTypes: (raw.employmentTypes ?? []).map(
      (type) => EMPLOYMENT_LABELS[type] ?? type,
    ),
    location: raw.jobLocations?.[0]?.name ?? null,
    deadline: formatDeadline(raw),
    applyUrl: raw.applyUrl,
    isPrivate: raw.isPrivate,
  };
}

/** 전체 채용 공고를 페이지 단위로 모두 가져온다 */
export async function fetchAllJobs(): Promise<NinehireResult<NinehireJob[]>> {
  const jobs: NinehireJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await request<JobsResponse>(
      `/jobs?countPerPage=${PAGE_SIZE}&page=${page}`,
    );

    if (!result.ok) return result;

    jobs.push(...(result.data.results ?? []).map(toJob));

    if (jobs.length >= result.data.count || (result.data.results ?? []).length === 0) {
      break;
    }
  }

  return { ok: true, data: jobs };
}
