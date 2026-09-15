// 합격자 처우안 산정 기능 - 공통 타입 정의
// 이 기능은 지원자 이력서 / 건강보험 자격득실확인서 / 급여명세서 3개월치 / (선택) 인사마스터를
// 업로드받아 "처우산정" 시트를 자동 계산하고, 그 결과로 "채용품의" 필수값을 채운다.
// 업로드된 문서와 추출된 개인정보는 요청 처리 중에만 메모리에서 다루며 서버에 저장하지 않는다.

/** 이력서에서 추출한 지원자 기본사항 (처우산정 1. 기본사항) */
export type ResumeInfo = {
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: "남" | "여" | "";
  education: string;
  certificates: string;
  previousEmployer: string;
  previousDept: string;
  previousTitle: string;
};

/** 건강보험 자격득실확인서의 경력 한 줄 (처우산정 2. 경력사항) */
export type CareerRecord = {
  employer: string;
  acquiredAt: string; // 자격 취득일 YYYY-MM-DD
  lostAt: string; // 자격 상실일 YYYY-MM-DD ("" 이면 재직중)
  workDays: number; // 근무일수 (계산값)
  recognized: boolean; // 경력 인정 여부 (기본값은 추정치이며 담당자가 확정)
};

/** 급여명세서 한 달치에서 추출한 지급항목 (처우산정 4. 현 처우 확인) */
export type PayslipItem = {
  label: string;
  amount: number;
};

export type PayslipMonth = {
  month: string; // "2026-07"
  items: PayslipItem[];
  total: number; // 지급액 계
  include: boolean; // 평균 계산에 반영할지 여부 (일시금 등이 섞인 달은 제외 권장)
  note?: string; // 제외 권장 사유 등 자동 안내 문구
};

/** 인사마스터에서 조회한 동일 소속 재직자 벤치마크 한 명 */
export type BenchmarkPeer = {
  name: string;
  department: string;
  grade: string;
  title: string;
  careerYears: number;
  education: string;
  annualExcludingMeal: number;
  annualIncludingMeal: number;
};

/** 사내 직급 기준표 한 줄 (회사 정책 상수, 개인정보 아님) */
export type GradeRule = {
  grade: string; // L1~L7
  position: string; // 직위 명칭
  baseCareerYears: number; // 해당 직급 부여 기준 경력(년)
};

/** 화면에 표시·수정하는 처우산정 초안 전체 */
export type OfferDraft = {
  // 1. 기본사항 (이력서)
  resume: ResumeInfo;

  // 2. 경력사항 (건강보험 자격득실확인서)
  careers: CareerRecord[];

  // 3. 채용조건
  assignedDept: string; // 소속 (담당자 입력)
  grade: string; // 직급 (자동 추천값, 담당자가 최종 선택)
  title: string; // 직책
  employmentType: string; // 근로형태
  payType: string; // 급여유형
  joinDate: string; // 입사가능일

  // 4. 현 처우 확인 (급여명세서)
  payslips: PayslipMonth[];
  companyMealAllowanceMonthly: number; // 사내 기준 월 식대

  // 5. 처우 산정
  desiredAnnual: number | null; // 희망연봉 (담당자 입력)
  finalOfferAnnual: number | null; // 최종 제안연봉 (담당자 입력)

  // 참고: 동일 소속 재직자 벤치마크 (인사마스터, 선택)
  benchmarkPeers: BenchmarkPeer[];
};

/** 서버가 계산해 돌려주는 파생값 (수식 결과에 해당) */
export type OfferComputed = {
  totalRecognizedDays: number;
  totalCareerYears: number; // 산정 연차(총경력)
  suggestedGrade: string; // 기준경력표로 추천하는 직급
  gradeStep: string; // "대리 2년차" 형태
  averageMonthlyPay: number; // 정상월 평균 지급액
  currentAnnualIncludingMeal: number;
  currentAnnualExcludingMeal: number;
  desiredIncreaseRate: number | null;
  finalIncreaseRate: number | null;
  benchmarkAverageExcludingMeal: number | null;
  benchmarkAverageIncludingMeal: number | null;
};

/** 채용품의 시트에 그대로 들어가는 9개 필수값 */
export type RecruitmentProposal = {
  name: string;
  employmentType: string;
  department: string;
  grade: string;
  title: string;
  payType: string;
  contractAnnualSalary: string; // "45,000,000원"
  joinDate: string; // "2026.09.14.(월)"
  birthGender: string; // "1994년생(만 32세)/남"
  education: string;
  educationDetail: string;
  careerSummary: string; // "경력 4년(대한뉴팜, 경동제약)"
  gradeStep: string;
  jobDescription: string;
};
