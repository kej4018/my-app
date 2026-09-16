import { PDFParse } from "pdf-parse";
import { ocrPdfPage, ocrPdfPages } from "./ocr";

// PDF 파일에서 텍스트를 추출하는 공용 함수.
// 업로드된 파일은 이 함수 호출이 끝나면 더 이상 참조를 유지하지 않는다 (서버 저장 없음).

/** 이 길이보다 텍스트가 적게 나오면 "텍스트 레이어가 없는 스캔본"으로 보고 OCR로 보완한다 */
export const MIN_MEANINGFUL_TEXT_LENGTH = 20;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    // pdf-parse는 기본적으로 페이지 사이에 "-- 1 of 1 --" 같은 구분 마커를 끼워 넣는데,
    // 이 마커가 마지막 항목(자격증 등)에 섞여 들어가는 문제가 있어 비워둔다.
    const result = await parser.getText({ pageJoiner: "" });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

/**
 * PDF에 선으로 그려진 표(셀 경계)를 감지해 행×열 구조로 반환한다.
 * 자격득실확인서·급여명세서처럼 테두리가 있는 표는 줄바꿈 기반 텍스트 추출보다
 * 이 방식이 훨씬 정확하다. 표가 없는 PDF는 빈 배열을 반환한다(오류 아님).
 */
export async function extractPdfTables(buffer: Buffer): Promise<string[][][]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getTable();
    return result.pages.flatMap((page) => page.tables);
  } finally {
    await parser.destroy();
  }
}

/**
 * 급여명세서처럼 한 PDF 파일 안에 여러 달치가 페이지별로 이어붙어 있을 수 있는 문서를 위해,
 * 페이지 단위로 텍스트와 표를 함께 반환한다. (파일 1개 = 1개월이라고 가정하지 않는다)
 */
export async function extractPdfPages(
  buffer: Buffer,
): Promise<{ text: string; tables: string[][][] }[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText({ pageJoiner: "" });
    const tableResult = await parser.getTable();

    const tablesByPage = new Map<number, string[][][]>();
    for (const page of tableResult.pages) {
      tablesByPage.set(page.num, page.tables);
    }

    return textResult.pages.map((page) => ({
      text: page.text,
      tables: tablesByPage.get(page.num) ?? [],
    }));
  } finally {
    await parser.destroy();
  }
}

/**
 * 이력서·건강보험확인서처럼 "문서 전체가 통째로 하나"인 경우를 위한 함수.
 * 네이티브 텍스트가 거의 없으면(=스캔본으로 추정) OCR로 자동 보완한다.
 */
export async function extractPdfTextWithOcr(
  buffer: Buffer,
): Promise<{ text: string; usedOcr: boolean }> {
  const nativeText = await extractPdfText(buffer);
  if (nativeText.trim().length >= MIN_MEANINGFUL_TEXT_LENGTH) {
    return { text: nativeText, usedOcr: false };
  }

  const ocrPages = await ocrPdfPages(buffer);
  const ocrText = ocrPages.join("\n\n");
  // OCR도 실패하면(빈 페이지 등) 원래 텍스트를 그대로 반환해 완전히 빈 값이 되지 않게 한다
  return ocrText.trim().length > 0
    ? { text: ocrText, usedOcr: true }
    : { text: nativeText, usedOcr: false };
}

/**
 * 급여명세서처럼 페이지 단위로 처리하는 문서를 위한 함수.
 * 페이지별 네이티브 텍스트가 거의 없는 페이지만 골라 그 페이지만 OCR로 보완한다.
 */
export async function extractPdfPagesWithOcr(
  buffer: Buffer,
): Promise<{ text: string; tables: string[][][]; usedOcr: boolean }[]> {
  const pages = await extractPdfPages(buffer);

  const results = await Promise.all(
    pages.map(async (page, index) => {
      if (page.text.trim().length >= MIN_MEANINGFUL_TEXT_LENGTH) {
        return { ...page, usedOcr: false };
      }
      const ocrText = await ocrPdfPage(buffer, index + 1);
      return ocrText.trim().length > 0
        ? { text: ocrText, tables: [], usedOcr: true }
        : { ...page, usedOcr: false };
    }),
  );

  return results;
}

export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
