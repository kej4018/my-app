import type { PayslipItem, PayslipMonth } from "./types";

// 급여명세서 PDF 텍스트에서 지급년월과 지급내역(항목별 금액)을 추출한다.
// "지급내역" 표만 사용하고 "공제내역"은 처우 산정과 무관하므로 읽지 않는다.

const AMOUNT_LINE = /^(.{1,12}?)\s+([\d,]{4,})\s*원?$/;

// 지급 총액과 무관한 표 제목·소계 라인은 항목으로 잡히지 않도록 제외한다
// (공백 제거 후 비교하므로 "지급액 계"/"지급액계" 같은 표기 차이도 함께 걸러진다)
const EXCLUDE_LABELS = [
  "수당합계",
  "공제합계",
  "실지급액",
  "지급내역",
  "공제내역",
  "지급액계",
].map((label) => label.replace(/\s/g, ""));

function extractMonth(text: string): string {
  const matched = text.match(/지급\s*년월\s*[:：]?\s*(\d{4})\s*년\s*(\d{1,2})\s*월/);
  if (!matched) return "";
  return `${matched[1]}-${matched[2].padStart(2, "0")}`;
}

function extractItems(text: string): PayslipItem[] {
  const start = text.indexOf("지급내역");
  const end = text.indexOf("공제내역");
  const section = start >= 0 ? text.slice(start, end > start ? end : undefined) : text;

  const items: PayslipItem[] = [];
  for (const rawLine of section.split(/\n/)) {
    const line = rawLine.replace(/\t/g, " ").trim();
    const matched = line.match(AMOUNT_LINE);
    if (!matched) continue;

    const label = matched[1].trim();
    const amount = Number(matched[2].replace(/,/g, ""));
    const normalizedLabel = label.replace(/\s/g, "");

    if (EXCLUDE_LABELS.some((excluded) => normalizedLabel.includes(excluded))) continue;
    if (!label || Number.isNaN(amount) || amount === 0) continue;

    items.push({ label, amount });
  }
  return items;
}

const AMOUNT_ONLY = /^[\d,]{4,}\s*원?$/;

/**
 * 표(선으로 그려진 급여명세서 지급내역 표)에서 "항목명, 금액" 두 칸짜리 행만 뽑는다.
 * 줄바꿈 기반 텍스트 추출이 표의 칸 순서를 흐트러뜨리는 경우에 더 안정적으로 동작한다.
 */
function extractItemsFromTables(tables: string[][][]): PayslipItem[] {
  const items: PayslipItem[] = [];

  for (const table of tables) {
    for (const row of table) {
      const cells = row.map((cell) => cell.trim()).filter((cell) => cell.length > 0);
      if (cells.length < 2) continue;

      const label = cells[0];
      const amountCell = cells.find((cell, index) => index > 0 && AMOUNT_ONLY.test(cell));
      if (!amountCell) continue;

      const normalizedLabel = label.replace(/\s/g, "");
      if (EXCLUDE_LABELS.some((excluded) => normalizedLabel.includes(excluded))) continue;

      const amount = Number(amountCell.replace(/[,원\s]/g, ""));
      if (!label || Number.isNaN(amount) || amount === 0) continue;

      items.push({ label, amount });
    }
  }

  return items;
}

/**
 * 한 달 급여명세서를 읽어 지급항목과 합계를 계산한다.
 * 표 구조를 먼저 시도하고, 표에서 아무것도 못 찾으면 줄바꿈 텍스트 방식으로 보완한다.
 * 파일명은 자동 인식이 안 될 때의 대체 라벨로만 쓴다.
 */
export function parsePayslip(
  text: string,
  fallbackLabel: string,
  tables: string[][][] = [],
): PayslipMonth {
  const month = extractMonth(text) || fallbackLabel;
  const items = extractItemsFromTables(tables);
  const finalItems = items.length > 0 ? items : extractItems(text);
  const total = finalItems.reduce((sum, item) => sum + item.amount, 0);

  return { month, items: finalItems, total, include: true };
}

/**
 * 여러 달의 지급액 계를 비교해 유난히 큰 달(연차수당 일시 정산 등 일회성 포함 가능성)에
 * 담당자가 확인하도록 안내 문구를 붙인다. 자동으로 제외하지는 않는다.
 */
export function flagUnusualMonths(months: PayslipMonth[]): PayslipMonth[] {
  if (months.length < 2) return months;

  const totals = months.map((month) => month.total).filter((total) => total > 0);
  const median = [...totals].sort((a, b) => a - b)[Math.floor(totals.length / 2)];

  return months.map((month) => {
    if (median > 0 && month.total > median * 1.15) {
      return {
        ...month,
        note: "다른 달보다 지급액이 15% 이상 높습니다. 일시금(연차수당 등) 포함 여부를 확인하고 평균 반영 여부를 결정하세요.",
      };
    }
    return month;
  });
}
