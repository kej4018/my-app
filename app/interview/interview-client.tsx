"use client";

import { useState } from "react";
import { MIN_SLOTS } from "../lib/interview";
import type { CoordinationStatus, Position } from "../lib/types";

export type InterviewView = {
  id: string;
  applicantName: string;
  positionTitle: string;
  status: CoordinationStatus;
  applicantSlots: string[];
  managerSlots: string[];
  suggestions: string[];
  confirmedSlot?: string;
  note?: string;
  elapsed: string;
  overdue: boolean;
};

const statusStyles: Record<CoordinationStatus, string> = {
  승인대기: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  담당자확인필요: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  확정: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

function SlotPicker({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (slot: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        {title}{" "}
        <span
          className={
            selected.length < MIN_SLOTS
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }
        >
          {selected.length}개 선택 (최소 {MIN_SLOTS}개)
        </span>
      </p>
      <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded border border-slate-200 p-2 sm:grid-cols-2 dark:border-slate-800">
        {options.map((slot) => (
          <label
            key={slot}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <input
              type="checkbox"
              checked={selected.includes(slot)}
              onChange={() => onToggle(slot)}
            />
            {slot}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function InterviewClient({
  positions,
  slotOptions,
  initialRequests,
}: {
  positions: Position[];
  slotOptions: string[];
  initialRequests: InterviewView[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [applicantName, setApplicantName] = useState("");
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [applicantSlots, setApplicantSlots] = useState<string[]>([]);
  const [managerSlots, setManagerSlots] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggle(list: string[], slot: string): string[] {
    return list.includes(slot)
      ? list.filter((item) => item !== slot)
      : [...list, slot];
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantName, positionId, applicantSlots, managerSlots }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "조율에 실패했습니다.");
      setLoading(false);
      return;
    }

    const positionTitle =
      positions.find((position) => position.id === positionId)?.title ?? "";

    setRequests((previous) => [
      {
        id: data.request.id,
        applicantName: data.request.applicantName,
        positionTitle,
        status: data.request.status,
        applicantSlots: data.request.applicantSlots,
        managerSlots: data.request.managerSlots,
        suggestions: data.result.suggestions,
        note: data.request.note,
        elapsed: "방금 요청",
        overdue: false,
      },
      ...previous,
    ]);

    setApplicantName("");
    setApplicantSlots([]);
    setManagerSlots([]);
    setLoading(false);
  }

  async function handleConfirm(id: string, slot: string) {
    const response = await fetch("/api/interview/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, slot }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "확정에 실패했습니다.");
      return;
    }

    setRequests((previous) =>
      previous.map((request) =>
        request.id === id
          ? { ...request, status: "확정", confirmedSlot: slot, note: undefined }
          : request,
      ),
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">면접 일정 조율</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          지원자와 현업 양쪽에서 각각 최소 {MIN_SLOTS}개의 가능 시간대를 받아야 자동 조율이
          진행되며, 담당자 승인 전에는 확정되지 않습니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">조율 현황</h2>
        {requests.map((request) => (
          <article
            key={request.id}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${statusStyles[request.status]}`}
              >
                {request.status}
              </span>
              <span className="font-medium">{request.applicantName}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {request.positionTitle}
              </span>
              <span className="ml-auto text-xs text-slate-400">{request.elapsed}</span>
            </div>

            {request.overdue && (
              <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                48시간 내 회신이 없어 담당자 확인이 필요합니다.
              </p>
            )}

            {request.note && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {request.note}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              지원자 {request.applicantSlots.length}개 / 현업{" "}
              {request.managerSlots.length}개 시간대 제시
            </p>

            {request.status === "확정" && request.confirmedSlot && (
              <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                확정 일시: {request.confirmedSlot}
              </p>
            )}

            {request.status === "승인대기" && request.suggestions.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  양쪽 모두 가능한 시간대 — 담당자가 승인하면 확정됩니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  {request.suggestions.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleConfirm(request.id, slot)}
                      className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    >
                      {slot} 승인
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">새 조율 요청</h2>
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">지원자 이름</span>
              <input
                value={applicantName}
                onChange={(event) => setApplicantName(event.target.value)}
                placeholder="예) 최우진"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SlotPicker
              title="지원자 가능 시간대"
              options={slotOptions}
              selected={applicantSlots}
              onToggle={(slot) =>
                setApplicantSlots((previous) => toggle(previous, slot))
              }
            />
            <SlotPicker
              title="현업 가능 시간대"
              options={slotOptions}
              selected={managerSlots}
              onToggle={(slot) => setManagerSlots((previous) => toggle(previous, slot))}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "조율 중..." : "조율 실행"}
            </button>
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          </div>
        </form>
      </section>
    </div>
  );
}
