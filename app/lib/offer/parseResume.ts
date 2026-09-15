import type { ResumeInfo } from "./types";

// 이력서 PDF 텍스트에서 처우산정 1. 기본사항에 필요한 값을 추출한다.
// 이력서 양식이 회사마다 달라 정규식 추정은 틀릴 수 있으므로,
// 여기서 뽑은 값은 항상 "추정값"이며 화면에서 담당자가 검토·수정한 뒤 확정해야 한다.

function findAfterLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:：]?\\s*([^\\n\\r\\t]{1,40})`);
    const matched = text.match(pattern);
    if (matched) {
      const value = matched[1].trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

function extractBirthDate(text: string): string {
  const labeled = findAfterLabel(text, ["생년월일"]);
  const source = labeled ?? text;
  const matched = source.match(/(\d{4})[.\-년]\s*(\d{1,2})[.\-월]\s*(\d{1,2})/);
  if (!matched) return "";
  const [, year, month, day] = matched;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractGender(text: string): ResumeInfo["gender"] {
  const labeled = findAfterLabel(text, ["성별"]);
  const source = labeled ?? text;
  if (/(^|[^가-힣])여(성)?([^가-힣]|$)/.test(source)) return "여";
  if (/(^|[^가-힣])남(성)?([^가-힣]|$)/.test(source)) return "남";
  return "";
}

function extractName(text: string): string {
  const labeled = findAfterLabel(text, ["성\\s*명", "이\\s*름"]);
  if (labeled) {
    // 라벨 뒤에 다른 항목명이 붙어 나오는 경우(예: "김우정 생년월일")를 잘라낸다
    const cleaned = labeled.split(/\s{2,}|생년월일|성별|연락처/)[0].trim();
    if (/^[가-힣]{2,5}$/.test(cleaned)) return cleaned;
  }
  return "";
}

function extractEducation(text: string): string {
  const lines = text.split(/\n/);
  // 우선 "OO대학교 ... (학사/졸업 등)"처럼 두 조건을 모두 만족하는 줄을 찾고,
  // 없으면 "대학"이나 "고등학교"가 들어간 줄만으로도 완화해서 찾는다
  // (한글은 JS 정규식의 \b 단어 경계로 구분되지 않으므로 사용하지 않는다)
  const strict = lines.find(
    (row) => /(대학교|대학원|대학)/.test(row) && /(학사|석사|박사|졸업|재학)/.test(row),
  );
  if (strict) return strict.trim();

  const loose = lines.find((row) => /(대학교|대학원|대학|고등학교)/.test(row));
  return loose?.trim() ?? "";
}

function extractCertificates(text: string): string {
  const section = text.match(/자격\s*(증|사항)[^\n]*\n([\s\S]{0,300})/);
  if (!section) return "";
  const lines = section[2]
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^(경력|학력|어학)/.test(line))
    .slice(0, 3);
  return lines.join(", ");
}

/**
 * 경력 섹션에서 가장 최근(첫 번째로 나오는) 직장 정보를 직전 직장으로 추정한다.
 * "2021.01 ~ 재직 (주)OO 영업부 대리"처럼 "재직/입사/근무"가 회사명 앞에 오는 경우와
 * 뒤에 오는 경우를 모두 다루기 위해, 우선 날짜 범위와 재직 관련 키워드를 지운 뒤
 * 남은 텍스트에서 부서·직급을 떼어내고 나머지를 회사명으로 본다.
 */
function extractPreviousJob(text: string): { employer: string; dept: string; title: string } {
  const careerSection = text.match(/경력\s*사항[\s\S]{0,600}/)?.[0] ?? text;
  const lines = careerSection
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const jobLine = lines.find(
    (line, index) => index > 0 && !line.startsWith("-") && /[가-힣]{2,}/.test(line),
  );
  if (!jobLine) return { employer: "", dept: "", title: "" };

  const stripped = jobLine
    .replace(
      /\d{4}[.\-]\d{1,2}(?:[.\-]\d{1,2})?\s*[~\-]\s*(?:\d{4}[.\-]\d{1,2}(?:[.\-]\d{1,2})?|재직중?|현재)/g,
      " ",
    )
    .replace(/재직중?|입사|근무/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const deptMatch = stripped.match(/([가-힣]{2,6}(?:부|팀|본부))/);
  const titleMatch = stripped.match(/(사원|주임|대리|과장|차장|부장|팀장|이사)/);

  const employer = stripped
    .replace(deptMatch?.[0] ?? "", "")
    .replace(titleMatch?.[0] ?? "", "")
    .trim();

  return {
    employer,
    dept: deptMatch?.[1]?.trim() ?? "",
    title: titleMatch?.[1]?.trim() ?? "",
  };
}

export function parseResume(text: string): ResumeInfo {
  const previousJob = extractPreviousJob(text);

  return {
    name: extractName(text),
    birthDate: extractBirthDate(text),
    gender: extractGender(text),
    education: extractEducation(text),
    certificates: extractCertificates(text),
    previousEmployer: previousJob.employer,
    previousDept: previousJob.dept,
    previousTitle: previousJob.title,
  };
}
