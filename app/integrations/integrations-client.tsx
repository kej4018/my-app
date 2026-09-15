"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NinehireJob } from "../lib/ninehire";

/** 자동 갱신 주기 (초) */
const REFRESH_SECONDS = 30;

type Changes = {
  addedIds: string[];
  updatedIds: string[];
  removedTitles: string[];
  at: string;
};

/** 이전 목록과 비교해 추가·변경·삭제된 공고를 찾는다 */
function diffJobs(previous: NinehireJob[], next: NinehireJob[]): Changes | null {
  const previousMap = new Map(previous.map((job) => [job.id, job]));
  const nextIds = new Set(next.map((job) => job.id));

  const addedIds = next.filter((job) => !previousMap.has(job.id)).map((job) => job.id);
  const updatedIds = next
    .filter((job) => {
      const before = previousMap.get(job.id);
      return before && JSON.stringify(before) !== JSON.stringify(job);
    })
    .map((job) => job.id);
  const removedTitles = previous
    .filter((job) => !nextIds.has(job.id))
    .map((job) => job.title);

  if (addedIds.length + updatedIds.length + removedTitles.length === 0) return null;

  return {
    addedIds,
    updatedIds,
    removedTitles,
    at: new Date().toLocaleTimeString("ko-KR"),
  };
}

function StatusBadge({ job }: { job: NinehireJob }) {
  const style =
    job.statusCode === "in_progress"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : job.statusCode === "closed"
        ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${style}`}>
      {job.status}
    </span>
  );
}

export default function IntegrationsClient({ keyConfigured }: { keyConfigured: boolean }) {
  const [jobs, setJobs] = useState<NinehireJob[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [changes, setChanges] = useState<Changes | null>(null);

  // 갱신 콜백이 매번 새로 만들어지지 않도록 최신 목록을 ref로 들고 있는다
  const jobsRef = useRef<NinehireJob[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/ninehire/jobs", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "연결에 실패했습니다.");
        return;
      }

      const next: NinehireJob[] = data.jobs;
      const previous = jobsRef.current;

      if (previous) {
        const diff = diffJobs(previous, next);
        if (diff) setChanges(diff);
      }

      jobsRef.current = next;
      setJobs(next);
      setError("");
      setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
    } catch {
      setError("연결에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 진입 시 자동으로 한 번 불러온다
  useEffect(() => {
    if (!keyConfigured) return;
    queueMicrotask(load);
  }, [keyConfigured, load]);

  // 자동 갱신: 탭이 보이지 않는 동안에는 호출하지 않고, 다시 돌아오면 즉시 갱신한다
  useEffect(() => {
    if (!keyConfigured || !autoRefresh) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_SECONDS * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [keyConfigured, autoRefresh, load]);

  const openCount = jobs?.filter((job) => job.statusCode === "in_progress").length ?? 0;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">ATS(나인하이어) 연동</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          나인하이어에 등록된 채용 공고를 읽기 전용으로 불러옵니다. 데이터를 생성·수정하는
          연동은 수행하지 않습니다.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">연결 상태</h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">API 키</dt>
            <dd>
              {keyConfigured ? (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  설정됨
                </span>
              ) : (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  미설정
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">연동 범위</dt>
            <dd className="text-slate-600 dark:text-slate-300">
              채용 공고 조회 (읽기 전용)
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">자동 갱신</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
                {REFRESH_SECONDS}초마다 자동으로 다시 불러오기
              </label>
              {lastUpdated && (
                <span className="text-xs text-slate-400">
                  마지막 갱신 {lastUpdated}
                  {loading && " · 갱신 중..."}
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-start gap-3">
            <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">지원자 정보</dt>
            <dd className="text-slate-600 dark:text-slate-300">
              로그인·접근 제어 적용 후 진행 예정 (개인정보 보호)
            </dd>
          </div>
        </dl>

        {!keyConfigured && (
          <div className="mt-4 rounded bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <p className="font-medium">API 키를 먼저 설정해 주세요.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>나인하이어 → 설정 → 외부 서비스 연동 → 데이터 → API 탭에서 키 발급</li>
              <li>
                프로젝트 루트 <code>.env</code> 파일에{" "}
                <code>NINEHIRE_API_KEY=발급받은키</code> 한 줄 추가
              </li>
              <li>개발 서버 재시작</li>
            </ol>
          </div>
        )}

        <button
          onClick={load}
          disabled={loading || !keyConfigured}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "불러오는 중..." : "지금 새로고침"}
        </button>

        {error && (
          <p className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}
      </section>

      {changes && (
        <section className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/40">
          <h2 className="font-semibold text-blue-800 dark:text-blue-200">
            {changes.at} 나인하이어 변경 사항 감지
          </h2>
          <ul className="mt-1 space-y-1 text-blue-800 dark:text-blue-200">
            {changes.addedIds.length > 0 && <li>새 공고 {changes.addedIds.length}건</li>}
            {changes.updatedIds.length > 0 && (
              <li>내용이 바뀐 공고 {changes.updatedIds.length}건 (아래 표에서 강조 표시)</li>
            )}
            {changes.removedTitles.length > 0 && (
              <li>삭제된 공고: {changes.removedTitles.join(", ")}</li>
            )}
          </ul>
        </section>
      )}

      {jobs && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold">채용 공고 {jobs.length}건</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              진행중 {openCount}건 · 마감 {jobs.length - openCount}건
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">공고명</th>
                  <th className="px-3 py-2 font-medium">소속</th>
                  <th className="px-3 py-2 font-medium">직군 / 직무</th>
                  <th className="px-3 py-2 font-medium">경력</th>
                  <th className="px-3 py-2 font-medium">고용형태</th>
                  <th className="px-3 py-2 font-medium">마감일</th>
                  <th className="px-3 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const isNew = changes?.addedIds.includes(job.id);
                  const isUpdated = changes?.updatedIds.includes(job.id);

                  return (
                    <tr
                      key={job.id}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        isNew || isUpdated ? "bg-blue-50 dark:bg-blue-950/30" : ""
                      }`}
                    >
                      <td className="px-3 py-3 font-medium">
                        {job.applyUrl ? (
                          <a
                            href={job.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {job.title}
                          </a>
                        ) : (
                          job.title
                        )}
                        {isNew && (
                          <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
                            NEW
                          </span>
                        )}
                        {isUpdated && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                            변경됨
                          </span>
                        )}
                        {job.isPrivate && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            비공개
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        {job.affiliation ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        {[job.jobGroup, job.jobTask].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        {job.career ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        {job.employmentTypes.join(", ") || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        {job.deadline ?? "-"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge job={job} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
