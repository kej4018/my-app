"use client";

import { useState } from "react";
import type { Position, ScreeningRecord, ScreeningVerdict } from "../lib/types";

const verdictStyles: Record<ScreeningVerdict, string> = {
  적합: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  확인필요: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  부적합: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const statusStyles: Record<string, string> = {
  충족: "text-emerald-600 dark:text-emerald-400",
  모호: "text-amber-600 dark:text-amber-400",
  미충족: "text-rose-600 dark:text-rose-400",
};

// 데모용 샘플 이력서 (판정 결과가 서로 다르게 나오도록 구성)
const sampleResumes = [
  {
    label: "샘플 A (적합)",
    name: "김서연",
    text: "경력 7년\n2019-2026 OO메디칼 품질경영팀\n- 의료기기 인허가 업무 총괄 (MFDS 허가 12건)\n- GMP 심사 대응 및 기술문서 작성\n- 해외 인증 대응 경험 보유",
  },
  {
    label: "샘플 B (확인필요)",
    name: "박도현",
    text: "OO기기 재직 3년 (2023-2026) 품질팀\nXX헬스케어 재직 2년 (2021-2023)\n- 의료기기 인허가 서류 작성 지원\n- GMP 관련 문서 관리 업무 수행",
  },
  {
    label: "샘플 C (부적합)",
    name: "이하준",
    text: "경력 1년\n2025-2026 OO메디칼 품질팀 인턴\n- 의료기기 인허가 보조 업무\n- GMP 문서 정리 지원",
  },
];

export default function ScreeningClient({ positions }: { positions: Position[] }) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [applicantName, setApplicantName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [record, setRecord] = useState<ScreeningRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = positions.find((position) => position.id === positionId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setRecord(null);

    const response = await fetch("/api/screening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionId, applicantName, resumeText }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "스크리닝에 실패했습니다.");
    } else {
      setRecord(data.record);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">이력서 1차 스크리닝</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          HR이 설정한 필수 자격요건으로 지원자를 적합 / 확인필요 / 부적합으로 분류합니다.
          최종 합격 여부는 담당자가 결정합니다.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">채용 포지션</span>
            <select
              value={positionId}
              onChange={(event) => setPositionId(event.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">지원자 이름</span>
            <input
              value={applicantName}
              onChange={(event) => setApplicantName(event.target.value)}
              placeholder="예) 김서연"
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>

        {selected && (
          <p className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            적용 기준 · 최소 경력 {selected.minYears}년 / 필수:{" "}
            {selected.requiredKeywords.join(", ")} / 우대:{" "}
            {selected.preferredKeywords.join(", ")}
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">이력서 내용</span>
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            rows={8}
            placeholder="이력서 텍스트를 붙여넣으세요."
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {sampleResumes.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setApplicantName(sample.name);
                setResumeText(sample.text);
                setPositionId("ra");
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {sample.label}
            </button>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="ml-auto rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "분석 중..." : "스크리닝 실행"}
          </button>
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </form>

      {record && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded px-3 py-1 text-sm font-semibold ${verdictStyles[record.verdict]}`}
            >
              {record.verdict}
            </span>
            <span className="font-medium">{record.applicantName}</span>
          </div>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {record.summary}
          </p>

          <ul className="mt-4 space-y-2">
            {record.criteria.map((criterion) => (
              <li
                key={criterion.label}
                className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${statusStyles[criterion.status]}`}
                  >
                    {criterion.status}
                  </span>
                  <span className="font-medium">{criterion.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {criterion.detail}
                </p>
              </li>
            ))}
          </ul>

          {record.preferredHits.length > 0 && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              우대사항 충족: {record.preferredHits.join(", ")}
            </p>
          )}

          {record.verdict === "확인필요" && (
            <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              담당자가 이력서를 직접 검토해 최종 판단해 주세요.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
