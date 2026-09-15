// 외부 라이브러리 없이 SVG·CSS로 그리는 대시보드용 차트 모음

export type Slice = {
  label: string;
  value: number;
  color: string;
};

/** 도넛 차트 (가운데에 합계 표시) */
export function DonutChart({
  slices,
  size = 168,
  thickness = 26,
  centerLabel,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-40 w-40 shrink-0"
      role="img"
      aria-label="스크리닝 결과 분포"
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-slate-200 dark:text-slate-800"
        />
        {total > 0 &&
          slices.map((slice) => {
            const length = (slice.value / total) * circumference;
            const element = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-consumed}
              />
            );
            consumed += length;
            return element;
          })}
      </g>
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        className="fill-current text-2xl font-bold"
      >
        {total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        className="fill-current text-[11px] text-slate-500"
        opacity={0.6}
      >
        {centerLabel ?? "건"}
      </text>
    </svg>
  );
}

/** 범례 (색상 + 항목명 + 건수) */
export function Legend({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ul className="space-y-2 text-sm">
      {slices.map((slice) => (
        <li key={slice.label} className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: slice.color }}
          />
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
            {slice.label}
          </span>
          <span className="ml-auto whitespace-nowrap font-medium">{slice.value}건</span>
          <span className="w-10 shrink-0 text-right text-xs text-slate-400">
            {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 가로 누적 막대 (표 안에서 비율을 보여줄 때 사용) */
export function StackedBar({ segments }: { segments: Slice[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return <div className="h-2 w-full rounded bg-slate-200 dark:bg-slate-700" />;
  }

  return (
    <div className="flex h-2 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
      {segments.map((segment) =>
        segment.value > 0 ? (
          <div
            key={segment.label}
            title={`${segment.label} ${segment.value}건`}
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ) : null,
      )}
    </div>
  );
}

/** 채용 단계별 퍼널 (단계별 인원과 전환율) */
export function FunnelChart({
  steps,
}: {
  steps: { label: string; value: number; color: string }[];
}) {
  const base = steps[0]?.value ?? 0;

  return (
    <ul className="space-y-3">
      {steps.map((step, index) => {
        const ratio = base > 0 ? step.value / base : 0;
        const previous = steps[index - 1];
        const conversion =
          previous && previous.value > 0
            ? Math.round((step.value / previous.value) * 100)
            : null;

        return (
          <li key={step.label}>
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{step.label}</span>
              <span className="ml-auto font-medium">{step.value}명</span>
              {conversion !== null && (
                <span className="w-20 text-right text-xs text-slate-400">
                  전 단계 대비 {conversion}%
                </span>
              )}
            </div>
            <div className="h-6 w-full rounded bg-slate-100 dark:bg-slate-800">
              <div
                className="flex h-6 items-center justify-end rounded px-2 text-xs font-medium text-white"
                style={{
                  width: `${Math.max(ratio * 100, step.value > 0 ? 8 : 0)}%`,
                  backgroundColor: step.color,
                }}
              >
                {step.value > 0 && `${Math.round(ratio * 100)}%`}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
