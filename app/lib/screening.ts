import type {
  CriterionResult,
  CriterionStatus,
  Position,
  ScreeningResult,
} from "./types";

// PRD 5) Must 1 - 이력서 1차 스크리닝 규칙
// 필수 자격요건 미충족이 하나라도 있으면 "부적합",
// 판단이 애매한 항목이 하나라도 있으면 "확인필요",
// 모두 충족해야 "적합"으로 분류한다. 최종 합격/불합격은 담당자가 결정한다.

/** 이력서 본문에서 총 경력 연차를 추출한다. 확신할 수 없으면 confident=false */
function extractYears(text: string): { years: number | null; confident: boolean } {
  // "경력 7년", "총 5년", "3년 차"처럼 총 경력을 명시한 표현을 우선 신뢰한다
  const explicitPatterns = [
    /경력\s*(?:총\s*)?(\d{1,2})\s*년/,
    /총\s*(?:경력\s*)?(\d{1,2})\s*년/,
    /(\d{1,2})\s*년\s*차/,
  ];

  for (const pattern of explicitPatterns) {
    const matched = text.match(pattern);
    if (matched) {
      return { years: Number(matched[1]), confident: true };
    }
  }

  // 총 경력 표기가 없으면 개별 재직 기간만 보고 추정하므로 담당자 확인이 필요하다
  const loose = [...text.matchAll(/(?<!\d)(\d{1,2})\s*년/g)].map((m) =>
    Number(m[1]),
  );
  if (loose.length > 0) {
    return { years: Math.max(...loose), confident: false };
  }

  return { years: null, confident: false };
}

/** 공백과 대소문자를 제거해 키워드 포함 여부를 비교하기 쉽게 만든다 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

/** 필수 키워드가 이력서에 있는지 판정한다 (일부만 있으면 모호) */
function matchKeyword(text: string, keyword: string): CriterionStatus {
  const haystack = normalize(text);
  const tokens = keyword.split(/[\s/]+/).filter((token) => token.length > 0);
  const hits = tokens.filter((token) => haystack.includes(normalize(token)));

  if (hits.length === tokens.length) return "충족";
  if (hits.length > 0) return "모호";
  return "미충족";
}

export function screenResume(
  position: Position,
  resumeText: string,
): ScreeningResult {
  const criteria: CriterionResult[] = [];
  const trimmed = resumeText.trim();

  // 1) 경력 연차 기준
  const { years, confident } = extractYears(trimmed);
  if (years === null) {
    criteria.push({
      label: `최소 경력 ${position.minYears}년`,
      status: "모호",
      detail: "이력서에서 경력 연차를 찾지 못했습니다. 담당자 확인이 필요합니다.",
    });
  } else if (years < position.minYears) {
    criteria.push({
      label: `최소 경력 ${position.minYears}년`,
      status: "미충족",
      detail: `이력서상 경력 ${years}년으로 기준(${position.minYears}년)에 미달합니다.`,
    });
  } else if (!confident) {
    criteria.push({
      label: `최소 경력 ${position.minYears}년`,
      status: "모호",
      detail: `총 경력 표기가 없어 재직 기간에서 약 ${years}년으로 추정했습니다. 담당자 확인이 필요합니다.`,
    });
  } else {
    criteria.push({
      label: `최소 경력 ${position.minYears}년`,
      status: "충족",
      detail: `이력서상 경력 ${years}년으로 기준을 충족합니다.`,
    });
  }

  // 2) 필수 자격요건 키워드 기준
  for (const keyword of position.requiredKeywords) {
    const status = matchKeyword(trimmed, keyword);
    const detail =
      status === "충족"
        ? `이력서에서 '${keyword}' 관련 내용을 확인했습니다.`
        : status === "모호"
          ? `'${keyword}' 중 일부 표현만 확인되어 담당자 확인이 필요합니다.`
          : `이력서에서 '${keyword}' 관련 내용을 찾지 못했습니다.`;
    criteria.push({ label: `필수: ${keyword}`, status, detail });
  }

  const preferredHits = position.preferredKeywords.filter(
    (keyword) => matchKeyword(trimmed, keyword) === "충족",
  );

  const failed = criteria.filter((item) => item.status === "미충족");
  const unclear = criteria.filter((item) => item.status === "모호");

  if (failed.length > 0) {
    return {
      verdict: "부적합",
      summary: `필수 자격요건 ${failed.length}건을 충족하지 못했습니다.`,
      criteria,
      preferredHits,
    };
  }

  if (unclear.length > 0) {
    return {
      verdict: "확인필요",
      summary: `판단이 애매한 항목이 ${unclear.length}건 있어 담당자 검토가 필요합니다.`,
      criteria,
      preferredHits,
    };
  }

  return {
    verdict: "적합",
    summary: "필수 자격요건을 모두 충족합니다. 서류합격 여부는 담당자가 결정합니다.",
    criteria,
    preferredHits,
  };
}
