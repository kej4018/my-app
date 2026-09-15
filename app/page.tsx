import Link from "next/link";
import { DonutChart, FunnelChart, Legend, StackedBar } from "./components/charts";
import { requireUser } from "./lib/auth/guard";
import { elapsedLabel, isOverdue } from "./lib/interview";
import { buildProbationSchedule } from "./lib/schedule";
import { listInterviews, listScreenings, newHires, positions } from "./lib/store";
import type { CoordinationStatus, ScreeningVerdict } from "./lib/types";

// 메모리 저장소의 최신 상태를 항상 보여주기 위해 매 요청마다 렌더링한다
export const dynamic = "force-dynamic";

const verdictColors: Record<ScreeningVerdict, string> = {
  적합: "#10b981",
  확인필요: "#f59e0b",
  부적합: "#f43f5e",
};

const verdictBadges: Record<ScreeningVerdict, string> = {
  적합: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  확인필요: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  부적합: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const statusBadges: Record<CoordinationStatus, string> = {
  확정: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  승인대기: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  담당자확인필요: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function KpiCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: number;
  unit: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {value}
        <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      <div className={description ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireUser("/");
  const isAdmin = user.role === "admin";

  const screenings = listScreenings();
  const interviews = listInterviews();
  const overdueList = interviews.filter((request) => isOverdue(request));

  const countVerdict = (verdict: ScreeningVerdict) =>
    screenings.filter((item) => item.verdict === verdict).length;

  const verdictSlices = (["적합", "확인필요", "부적합"] as ScreeningVerdict[]).map(
    (verdict) => ({
      label: verdict,
      value: countVerdict(verdict),
      color: verdictColors[verdict],
    }),
  );

  const confirmedCount = interviews.filter((item) => item.status === "확정").length;

  // 채용 단계별 퍼널
  // 확인필요는 담당자 검토 후 면접으로 이어질 수 있으므로 적합과 함께 면접 후보로 집계한다
  const funnelSteps = [
    { label: "서류 접수", value: screenings.length, color: "#64748b" },
    {
      label: "면접 후보 (적합 + 확인필요)",
      value: countVerdict("적합") + countVerdict("확인필요"),
      color: "#3b82f6",
    },
    { label: "면접 조율 중", value: interviews.length, color: "#8b5cf6" },
    { label: "면접 확정", value: confirmedCount, color: "#10b981" },
  ];

  const probations = newHires
    .map((hire) => buildProbationSchedule(hire))
    .sort((a, b) => a.nextInDays - b.nextInDays);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">채용 현황 대시보드</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          담당자 4명의 채용 진행 상황을 한 곳에서 확인합니다. (PoC · 데이터는 서버 재시작 시
          초기화됩니다)
        </p>
      </section>

      {overdueList.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            48시간 무응답 알림 {overdueList.length}건
          </h2>
          <ul className="mt-1 space-y-1 text-sm text-amber-800 dark:text-amber-200">
            {overdueList.map((request) => (
              <li key={request.id}>
                {request.applicantName} · {elapsedLabel(request)} — 일정 조율 회신이 없어
                담당자 확인이 필요합니다.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="진행 중 포지션"
          value={positions.length}
          unit="개"
          hint="채용요청서 기준"
        />
        <KpiCard
          label="누적 지원자"
          value={screenings.length}
          unit="명"
          hint="스크리닝 완료 기준"
        />
        <KpiCard
          label="면접 조율"
          value={interviews.length}
          unit="건"
          hint={`확정 ${confirmedCount}건`}
        />
        <KpiCard
          label="담당자 확인 대기"
          value={
            countVerdict("확인필요") +
            interviews.filter((item) => item.status !== "확정").length
          }
          unit="건"
          hint="확인필요 + 미확정 조율"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="스크리닝 결과 분포"
          description="AI는 1차 분류만 수행하며, 최종 합격 여부는 담당자가 결정합니다."
        >
          <div className="flex items-center gap-4">
            <DonutChart slices={verdictSlices} centerLabel="지원자" />
            <div className="min-w-0 flex-1">
              <Legend slices={verdictSlices} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="채용 단계별 퍼널"
          description="서류 접수부터 면접 확정까지 단계별 인원과 전환율입니다."
        >
          <FunnelChart steps={funnelSteps} />
        </SectionCard>
      </div>

      <SectionCard
        title="포지션별 채용 현황"
        description="포지션마다 스크리닝 결과 구성과 면접 진행 상황을 함께 보여줍니다."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">포지션</th>
                <th className="px-3 py-2 font-medium">현업 부서</th>
                <th className="px-3 py-2 font-medium">지원자</th>
                <th className="px-3 py-2 font-medium">적합</th>
                <th className="px-3 py-2 font-medium">확인필요</th>
                <th className="px-3 py-2 font-medium">부적합</th>
                <th className="px-3 py-2 font-medium">면접(확정)</th>
                <th className="w-32 px-3 py-2 font-medium">구성 비율</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const rows = screenings.filter(
                  (item) => item.positionId === position.id,
                );
                const byVerdict = (verdict: ScreeningVerdict) =>
                  rows.filter((item) => item.verdict === verdict).length;
                const positionInterviews = interviews.filter(
                  (item) => item.positionId === position.id,
                );
                const segments = (
                  ["적합", "확인필요", "부적합"] as ScreeningVerdict[]
                ).map((verdict) => ({
                  label: verdict,
                  value: byVerdict(verdict),
                  color: verdictColors[verdict],
                }));

                return (
                  <tr
                    key={position.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-3 py-3 font-medium">{position.title}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                      {position.department}
                    </td>
                    <td className="px-3 py-3">{rows.length}명</td>
                    <td className="px-3 py-3 text-emerald-600 dark:text-emerald-400">
                      {byVerdict("적합")}
                    </td>
                    <td className="px-3 py-3 text-amber-600 dark:text-amber-400">
                      {byVerdict("확인필요")}
                    </td>
                    <td className="px-3 py-3 text-rose-600 dark:text-rose-400">
                      {byVerdict("부적합")}
                    </td>
                    <td className="px-3 py-3">
                      {positionInterviews.length}건 (
                      {positionInterviews.filter((item) => item.status === "확정").length}
                      )
                    </td>
                    <td className="px-3 py-3">
                      <StackedBar segments={segments} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="면접 일정 조율 현황"
        description="최소 3개 시간대 규칙과 담당자 승인 상태를 함께 확인합니다."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">지원자</th>
                <th className="px-3 py-2 font-medium">포지션</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">제시 시간대</th>
                <th className="px-3 py-2 font-medium">경과</th>
                <th className="px-3 py-2 font-medium">확정 일시 / 비고</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((request) => (
                <tr
                  key={request.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-3 py-3 font-medium">{request.applicantName}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    {positions.find((item) => item.id === request.positionId)?.title}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadges[request.status]}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                    지원자 {request.applicantSlots.length} / 현업{" "}
                    {request.managerSlots.length}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {elapsedLabel(request)}
                    {isOverdue(request) && (
                      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        48h 초과
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {request.confirmedSlot ?? request.note ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          href="/interview"
          className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          일정 조율하러 가기 →
        </Link>
      </SectionCard>

      <SectionCard
        title="최근 스크리닝 결과"
        description="가장 최근에 분류된 지원자 5명입니다."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">지원자</th>
                <th className="px-3 py-2 font-medium">포지션</th>
                <th className="px-3 py-2 font-medium">판정</th>
                <th className="px-3 py-2 font-medium">요약</th>
              </tr>
            </thead>
            <tbody>
              {screenings.slice(0, 5).map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-3 py-3 font-medium">{record.applicantName}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    {positions.find((item) => item.id === record.positionId)?.title}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${verdictBadges[record.verdict]}`}
                    >
                      {record.verdict}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {record.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          href="/screening"
          className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          스크리닝 실행하러 가기 →
        </Link>
      </SectionCard>

      {/* 수습평가 대상자는 지원자가 아닌 재직 직원 정보이므로 관리자에게만 보여준다 */}
      {!isAdmin && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          재직자 관련 정보(수습평가 대상자 등)는 관리자만 조회할 수 있습니다.
        </section>
      )}

      {isAdmin && (
      <SectionCard
        title="수습평가 메일 발송 예정"
        description="입사일 기준 45일 차 중간평가, 80일 차 최종평가 메일 일정입니다."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">이름</th>
                <th className="px-3 py-2 font-medium">부서</th>
                <th className="px-3 py-2 font-medium">입사일</th>
                <th className="px-3 py-2 font-medium">45일 차</th>
                <th className="px-3 py-2 font-medium">80일 차</th>
                <th className="px-3 py-2 font-medium">다음 발송</th>
              </tr>
            </thead>
            <tbody>
              {probations.map((schedule) => (
                <tr
                  key={schedule.hire.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-3 py-3 font-medium">{schedule.hire.name}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    {schedule.hire.department}
                  </td>
                  <td className="px-3 py-3">{schedule.hire.joinedAt}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    {schedule.midDate}
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    {schedule.finalDate}
                  </td>
                  <td className="px-3 py-3">
                    {schedule.nextInDays >= 0 ? (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          schedule.nextInDays <= 7
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {schedule.nextLabel} D-{schedule.nextInDays}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">발송 완료</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      )}
    </div>
  );
}
