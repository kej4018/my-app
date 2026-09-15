"use client";

import { useMemo, useState } from "react";
import { computeOffer } from "../lib/offer/calculate";
import { GRADE_TABLE } from "../lib/offer/gradeTable";
import type { CareerRecord, OfferDraft, PayslipMonth } from "../lib/offer/types";

function formatWon(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "-";
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return "-";
  return `${(rate * 100).toFixed(1)}%`;
}

export default function OfferClient({ canUseBenchmark }: { canUseBenchmark: boolean }) {
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [debugText, setDebugText] = useState<{
    resume: string;
    healthInsurance: string;
    healthInsuranceTables: string[][][];
    payslips: { text: string; tables: string[][][] }[];
  } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [masterPassword, setMasterPassword] = useState("");
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");

  const [exporting, setExporting] = useState(false);

  const computed = useMemo(() => (draft ? computeOffer(draft) : null), [draft]);

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnalyzeError("");
    setAnalyzing(true);

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);

    try {
      const response = await fetch("/api/offer/analyze", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setAnalyzeError(data.error ?? "분석에 실패했습니다.");
        return;
      }
      setDraft(data.draft);
      setDebugText(data.debugText ?? null);
      setWarnings(data.warnings ?? []);
    } catch {
      setAnalyzeError("분석 요청에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateResume(field: keyof OfferDraft["resume"], value: string) {
    setDraft((prev) => (prev ? { ...prev, resume: { ...prev.resume, [field]: value } } : prev));
  }

  function updateCareer(index: number, patch: Partial<CareerRecord>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const careers = prev.careers.map((career, i) => {
        if (i !== index) return career;
        const next = { ...career, ...patch };
        if (next.acquiredAt && next.lostAt) {
          const days = Math.max(
            0,
            Math.round(
              (new Date(next.lostAt).getTime() - new Date(next.acquiredAt).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          );
          next.workDays = days;
        }
        return next;
      });
      return { ...prev, careers };
    });
  }

  function addCareer() {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            careers: [
              ...prev.careers,
              { employer: "", acquiredAt: "", lostAt: "", workDays: 0, recognized: true },
            ],
          }
        : prev,
    );
  }

  function removeCareer(index: number) {
    setDraft((prev) =>
      prev ? { ...prev, careers: prev.careers.filter((_, i) => i !== index) } : prev,
    );
  }

  function updatePayslip(index: number, patch: Partial<PayslipMonth>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const payslips = prev.payslips.map((month, i) =>
        i === index ? { ...month, ...patch } : month,
      );
      return { ...prev, payslips };
    });
  }

  async function handleBenchmark() {
    if (!draft) return;
    setBenchmarkError("");

    if (!masterFile) {
      setBenchmarkError("인사마스터 파일을 선택해 주세요.");
      return;
    }
    if (!masterPassword) {
      setBenchmarkError("인사마스터 파일 암호를 입력해 주세요.");
      return;
    }
    if (!draft.assignedDept.trim()) {
      setBenchmarkError("먼저 위의 '소속'을 입력해 주세요.");
      return;
    }

    setBenchmarkLoading(true);
    try {
      const formData = new FormData();
      formData.append("masterFile", masterFile);
      formData.append("password", masterPassword);
      formData.append("department", draft.assignedDept);
      formData.append("mealAllowance", String(draft.companyMealAllowanceMonthly));

      const response = await fetch("/api/offer/benchmark", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setBenchmarkError(data.error ?? "벤치마크 조회에 실패했습니다.");
        return;
      }

      setDraft((prev) => (prev ? { ...prev, benchmarkPeers: data.peers } : prev));
      // 암호는 화면에 남겨두지 않는다
      setMasterPassword("");
    } catch {
      setBenchmarkError("벤치마크 조회 요청에 실패했습니다.");
    } finally {
      setBenchmarkLoading(false);
    }
  }

  async function handleExport() {
    if (!draft) return;
    setExporting(true);
    try {
      const response = await fetch("/api/offer/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${draft.resume.name || "지원자"}_처우산정.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">합격자 처우안 산정</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          이력서·건강보험 자격득실확인서·급여명세서(3개월)를 올리면 처우산정을 자동 계산하고,
          채용품의에 필요한 값을 함께 채워줍니다. 업로드한 서류는 서버에 저장하지 않고 이 화면을
          벗어나면 사라집니다.
        </p>
      </section>

      <form
        onSubmit={handleAnalyze}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">1. 서류 업로드</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">이력서 (PDF)</span>
            <input type="file" name="resume" accept="application/pdf" required className="w-full text-xs" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">건강보험 자격득실확인서 (PDF)</span>
            <input
              type="file"
              name="healthInsurance"
              accept="application/pdf"
              required
              className="w-full text-xs"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">급여명세서 (PDF, 3개월분 여러 개 선택)</span>
            <input
              type="file"
              name="payslips"
              accept="application/pdf"
              multiple
              required
              className="w-full text-xs"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={analyzing}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {analyzing ? "분석 중..." : "서류 분석"}
        </button>

        {analyzeError && (
          <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {analyzeError}
          </p>
        )}
      </form>

      {draft && computed && (
        <>
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            자동 추출 결과는 문서 형식에 따라 틀릴 수 있습니다. 아래 값을 반드시 원본 서류와
            대조해 확인·수정한 뒤 사용하세요.
          </section>

          {warnings.length > 0 && (
            <section className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              <ul className="list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">2. 기본사항 (이력서)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">성명</span>
                <input
                  value={draft.resume.name}
                  onChange={(e) => updateResume("name", e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">생년월일</span>
                <input
                  type="date"
                  value={draft.resume.birthDate}
                  onChange={(e) => updateResume("birthDate", e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">성별</span>
                <select
                  value={draft.resume.gender}
                  onChange={(e) => updateResume("gender", e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">-</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">최종학력</span>
                <input
                  value={draft.resume.education}
                  onChange={(e) => updateResume("education", e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">자격증/어학</span>
                <input
                  value={draft.resume.certificates}
                  onChange={(e) => updateResume("certificates", e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">3. 경력사항 (건강보험 자격득실확인서)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-2 py-2">직장명</th>
                    <th className="px-2 py-2">취득일</th>
                    <th className="px-2 py-2">상실일</th>
                    <th className="px-2 py-2">근무일수</th>
                    <th className="px-2 py-2">인정</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.careers.map((career, index) => (
                    <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-2">
                        <input
                          value={career.employer}
                          onChange={(e) => updateCareer(index, { employer: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={career.acquiredAt}
                          onChange={(e) => updateCareer(index, { acquiredAt: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={career.lostAt}
                          onChange={(e) => updateCareer(index, { lostAt: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">{career.workDays || "-"}</td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={career.recognized}
                          onChange={(e) => updateCareer(index, { recognized: e.target.checked })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeCareer(index)}
                          className="text-xs text-rose-600 hover:underline dark:text-rose-400"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {draft.careers.length === 0 && (
                <p className="py-3 text-sm text-slate-500 dark:text-slate-400">
                  경력 이력을 자동으로 인식하지 못했습니다. 아래 &ldquo;직장 추가&rdquo;로 직접
                  입력하시거나, 원본 텍스트를 확인해 서류 형식을 살펴봐 주세요.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={addCareer}
              className="mt-2 rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              + 직장 추가
            </button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              경력 인정 합계: <span className="font-medium">{computed.totalRecognizedDays}일</span>{" "}
              (산정 연차 {computed.totalCareerYears}년차)
            </p>

            {debugText && (
              <details className="mt-4 rounded border border-slate-200 dark:border-slate-800">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  자동 인식이 안 될 때 — 추출된 원본 텍스트 확인 (이 브라우저에서만 보이며 저장되지
                  않습니다)
                </summary>
                <div className="space-y-3 border-t border-slate-200 p-3 text-xs dark:border-slate-800">
                  <div>
                    <p className="mb-1 font-medium text-slate-500 dark:text-slate-400">
                      건강보험 자격득실확인서 — 표로 인식된 결과 (
                      {debugText.healthInsuranceTables.length}개 표)
                    </p>
                    {debugText.healthInsuranceTables.length > 0 ? (
                      debugText.healthInsuranceTables.map((table, tableIndex) => (
                        <table key={tableIndex} className="mb-2 w-full border-collapse text-xs">
                          <tbody>
                            {table.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                  <td
                                    key={cellIndex}
                                    className="border border-slate-300 px-1 py-0.5 dark:border-slate-700"
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ))
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400">
                        표를 인식하지 못했습니다 (선으로 그려진 표가 없을 수 있습니다).
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-slate-500 dark:text-slate-400">
                      건강보험 자격득실확인서 추출 텍스트
                    </p>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 dark:bg-slate-950">
                      {debugText.healthInsurance || "(추출된 텍스트가 없습니다)"}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-slate-500 dark:text-slate-400">
                      이력서 추출 텍스트
                    </p>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 dark:bg-slate-950">
                      {debugText.resume || "(추출된 텍스트가 없습니다)"}
                    </pre>
                  </div>
                  {debugText.payslips.map((payslip, index) => (
                    <div key={index}>
                      <p className="mb-1 font-medium text-slate-500 dark:text-slate-400">
                        급여명세서 첨부 {index + 1} 추출 텍스트 (표 {payslip.tables.length}개 인식)
                      </p>
                      <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 dark:bg-slate-950">
                        {payslip.text || "(추출된 텍스트가 없습니다)"}
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">4. 채용조건</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">소속</span>
                <input
                  value={draft.assignedDept}
                  onChange={(e) => setDraft({ ...draft, assignedDept: e.target.value })}
                  placeholder="예) 영업1팀"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">
                  직급 (추천: {computed.suggestedGrade})
                </span>
                <select
                  value={draft.grade || computed.suggestedGrade}
                  onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                >
                  {GRADE_TABLE.map((rule) => (
                    <option key={rule.grade} value={rule.grade}>
                      {rule.grade} ({rule.position})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">직책</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">근로형태</span>
                <input
                  value={draft.employmentType}
                  onChange={(e) => setDraft({ ...draft, employmentType: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">급여유형</span>
                <input
                  value={draft.payType}
                  onChange={(e) => setDraft({ ...draft, payType: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">입사가능일</span>
                <input
                  type="date"
                  value={draft.joinDate}
                  onChange={(e) => setDraft({ ...draft, joinDate: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              직급 연차: <span className="font-medium">{computed.gradeStep}</span>
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">5. 현 처우 확인 (급여명세서)</h2>
            <div className="mt-3 space-y-3">
              {draft.payslips.map((month, index) => (
                <div key={index} className="rounded border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{month.month || `첨부 ${index + 1}`}</span>
                    {month.items.length > 0 ? (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        지급액 계 {formatWon(month.total)}
                      </span>
                    ) : (
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          지급액 계 (직접 입력)
                        </span>
                        <input
                          type="number"
                          value={month.total || ""}
                          onChange={(e) =>
                            updatePayslip(index, { total: Number(e.target.value) })
                          }
                          className="w-32 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        />
                        원
                      </label>
                    )}
                    <label className="ml-auto flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={month.include}
                        onChange={(e) => updatePayslip(index, { include: e.target.checked })}
                      />
                      평균에 반영
                    </label>
                  </div>
                  {month.items.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {month.items.map((item) => `${item.label} ${item.amount.toLocaleString()}`).join(" · ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      지급항목을 인식하지 못했습니다. 아래 &ldquo;원본 텍스트 확인&rdquo;에서
                      원인을 살펴보시거나, 위에 지급액 계만 직접 입력해 주세요.
                    </p>
                  )}
                  {month.note && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{month.note}</p>
                  )}
                </div>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">월 식대(사내 기준)</span>
              <input
                type="number"
                value={draft.companyMealAllowanceMonthly}
                onChange={(e) =>
                  setDraft({ ...draft, companyMealAllowanceMonthly: Number(e.target.value) })
                }
                className="w-32 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              />
              원
            </label>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">6. 처우 산정</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded bg-slate-50 p-3 text-sm dark:bg-slate-800">
                <p className="text-slate-500 dark:text-slate-400">정상월 평균 지급액</p>
                <p className="text-lg font-bold">{formatWon(computed.averageMonthlyPay)}</p>
              </div>
              <div className="rounded bg-slate-50 p-3 text-sm dark:bg-slate-800">
                <p className="text-slate-500 dark:text-slate-400">현 연봉 (식대 포함)</p>
                <p className="text-lg font-bold">{formatWon(computed.currentAnnualIncludingMeal)}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">
                  희망연봉 (인상률 {formatPercent(computed.desiredIncreaseRate)})
                </span>
                <input
                  type="number"
                  value={draft.desiredAnnual ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      desiredAnnual: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">
                  최종 제안연봉 (인상률 {formatPercent(computed.finalIncreaseRate)})
                </span>
                <input
                  type="number"
                  value={draft.finalOfferAnnual ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      finalOfferAnnual: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
          </section>

          {/* 전 직원 급여가 담긴 인사마스터를 다루므로 관리자에게만 보여준다 */}
          {canUseBenchmark && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">7. 동일 소속 재직자 벤치마크 (선택)</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              인사마스터 파일은 이 조회 요청에만 사용되고 서버에 저장되지 않습니다. 암호도 화면에
              남기지 않습니다.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">
                  인사마스터 파일 (.xlsx)
                </span>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setMasterFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">파일 암호</span>
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleBenchmark}
                  disabled={benchmarkLoading}
                  className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {benchmarkLoading ? "조회 중..." : "벤치마크 조회"}
                </button>
              </div>
            </div>
            {benchmarkError && (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{benchmarkError}</p>
            )}

            {draft.benchmarkPeers.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-2">성명</th>
                      <th className="px-2 py-2">부서/직급·직책/경력</th>
                      <th className="px-2 py-2">연봉(식대제외)</th>
                      <th className="px-2 py-2">연봉(식대포함)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.benchmarkPeers.map((peer, index) => (
                      <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-2">{peer.name}</td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-400">
                          {peer.department} / {peer.grade}·{peer.title} / {peer.careerYears}년
                        </td>
                        <td className="px-2 py-2">{formatWon(peer.annualExcludingMeal)}</td>
                        <td className="px-2 py-2">{formatWon(peer.annualIncludingMeal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  평균(식대포함): {formatWon(computed.benchmarkAverageIncludingMeal)}
                </p>
              </div>
            )}
          </section>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">8. 채용품의 생성</h2>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {exporting ? "생성 중..." : "엑셀 다운로드 (.xlsx)"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              처우산정 · 채용품의 두 시트로 구성된 새 엑셀 파일을 내려받습니다. 사내 원본 양식
              파일은 수정하지 않습니다.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
