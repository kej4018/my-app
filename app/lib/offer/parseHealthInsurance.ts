import type { CareerRecord } from "./types";

// 건강보험 자격득실확인서 PDF 텍스트에서 경력사항(직장명·취득일·상실일)을 추출한다.
// 국민건강보험공단 양식은 사업장명 / 자격취득일 / 자격상실일이 한 행에 나열되는 표 형태이지만,
// PDF에서 텍스트를 뽑아내는 과정에서 표의 각 칸이 줄바꿈으로 쪼개져 나오는 경우가 있어
// ① 한 줄 안에서 찾기 → ② 실패 시 인접한 여러 줄을 이어붙여 찾기, 두 단계로 시도한다.
// 날짜 표기는 "2025.07.01" / "2025-07-01" / "2025년 7월 1일" / "20250701" 등을 모두 허용한다.

const DATE_PATTERN =
  /(\d{4})\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})\s*일?|(\d{4})(\d{2})(\d{2})(?!\d)/g;

/** 정규식 한 매치(alternation 두 갈래 중 하나)에서 연·월·일을 뽑아 YYYY-MM-DD로 만든다 */
function toIsoDate(match: RegExpMatchArray): string {
  const [, y1, m1, d1, y2, m2, d2] = match;
  const year = y1 ?? y2;
  const month = m1 ?? m2;
  const day = d1 ?? d2;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function diffDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

/** 날짜와 자리표시 문구를 제외한 나머지 텍스트에서 사업장명으로 보이는 부분을 뽑는다 */
function extractEmployerName(line: string): string {
  const withoutDates = line
    .replace(DATE_PATTERN, " ")
    .replace(/\(?\s*재직\s*중?\s*\)?/g, " ") // "재직중"/"(재직중)" 같은 자리표시 문구 제거
    .replace(/\s{2,}/g, " ")
    .trim();
  // 번호(1, 2, 3...)나 표 구분 기호를 앞에서 제거
  const cleaned = withoutDates.replace(/^[\d.\s\-|]+/, "").trim();
  // 상실사유 코드 등 나머지 잡음 앞부분에서 회사명으로 보이는 토큰만 추출
  const nameMatch = cleaned.match(
    /([가-힣A-Za-z0-9&()㈜]+(?:\(주\)|주식회사|㈜)?[가-힣A-Za-z0-9&() ]*)/,
  );
  return (nameMatch?.[1] ?? cleaned).trim();
}

// 표 헤더 라벨을 회사명으로 잘못 뽑는 것을 막는다.
// 잘못된 값을 만드는 것보다 인식 실패로 두고 담당자가 "직장 추가"로 직접 입력하게 하는 편이 안전하다.
const HEADER_LABEL_KEYWORDS = ["사업장명", "사업장", "직장명", "자격취득일", "자격상실일", "취득일", "상실일"];

/** 한 줄(또는 이어붙인 여러 줄) 텍스트에서 경력 한 건을 뽑아본다. 실패하면 null */
function parseCareerLine(line: string): CareerRecord | null {
  const dates = [...line.matchAll(DATE_PATTERN)];
  if (dates.length === 0) return null;

  const employer = extractEmployerName(line);
  if (!employer || employer.length < 2) return null;
  if (HEADER_LABEL_KEYWORDS.some((keyword) => employer.includes(keyword))) return null;

  const acquiredAt = toIsoDate(dates[0]);
  const lostAt = dates.length >= 2 ? toIsoDate(dates[1]) : "";
  const workDays = lostAt ? diffDays(acquiredAt, lostAt) : 0;

  return { employer, acquiredAt, lostAt, workDays, recognized: true };
}

/**
 * 선으로 그려진 표에서 헤더 행의 컬럼 위치("사업장명"/"취득일"/"상실일"이 각각 몇 번째 칸인지)를
 * 먼저 찾고, 그 컬럼 인덱스를 그대로 데이터 행에 적용한다. 열 순서가 바뀌어도 안전하게 동작한다.
 */
function parseCareerTable(table: string[][]): CareerRecord[] {
  if (table.length < 2) return [];

  const headerRowIndex = table.findIndex((row) =>
    row.some((cell) => /사업장|직장/.test(cell)) && row.some((cell) => /취득/.test(cell)),
  );
  if (headerRowIndex === -1) return [];

  const header = table[headerRowIndex];
  const employerCol = header.findIndex((cell) => /사업장|직장/.test(cell));
  const acquiredCol = header.findIndex((cell) => /취득/.test(cell));
  const lostCol = header.findIndex((cell) => /상실/.test(cell));
  if (employerCol === -1 || acquiredCol === -1) return [];

  const records: CareerRecord[] = [];
  for (let i = headerRowIndex + 1; i < table.length; i++) {
    const row = table[i];
    const employer = (row[employerCol] ?? "").trim();
    const acquiredMatch = [...(row[acquiredCol] ?? "").matchAll(DATE_PATTERN)][0];
    if (!employer || !acquiredMatch) continue;

    const lostText = lostCol >= 0 ? (row[lostCol] ?? "") : "";
    const lostMatch = [...lostText.matchAll(DATE_PATTERN)][0];

    const acquiredAt = toIsoDate(acquiredMatch);
    const lostAt = lostMatch ? toIsoDate(lostMatch) : "";

    records.push({
      employer,
      acquiredAt,
      lostAt,
      workDays: lostAt ? diffDays(acquiredAt, lostAt) : 0,
      recognized: true,
    });
  }
  return records;
}

/** 여러 후보 표 중 경력사항 표로 보이는 첫 번째 표에서 경력을 뽑는다 */
export function parseHealthInsuranceCareersFromTables(tables: string[][][]): CareerRecord[] {
  for (const table of tables) {
    const records = parseCareerTable(table);
    if (records.length > 0) return records;
  }
  return [];
}

export function parseHealthInsuranceCareers(text: string): CareerRecord[] {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // 1단계: 표의 한 행이 한 줄에 온전히 들어있는 일반적인 경우
  const records = lines
    .map((line) => parseCareerLine(line))
    .filter((record): record is CareerRecord => record !== null);
  if (records.length > 0) return records;

  // 2단계: 칸별로 줄바꿈된 경우를 대비해 인접한 최대 4줄을 이어붙여 다시 시도한다.
  // (같은 값이 중복으로 잡히지 않도록 이미 사용한 줄은 건너뛴다)
  const merged: CareerRecord[] = [];
  const used = new Set<number>();
  for (let start = 0; start < lines.length; start++) {
    if (used.has(start)) continue;
    for (let span = 2; span <= 4 && start + span <= lines.length; span++) {
      const windowLines = Array.from({ length: span }, (_, i) => start + i);
      if (windowLines.some((i) => used.has(i))) break;

      const combined = windowLines.map((i) => lines[i]).join(" ");
      const record = parseCareerLine(combined);
      if (record) {
        merged.push(record);
        windowLines.forEach((i) => used.add(i));
        break;
      }
    }
  }

  return merged;
}
