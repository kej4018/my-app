import { PDFParse } from "pdf-parse";

// PDF 파일에서 텍스트를 추출하는 공용 함수.
// 업로드된 파일은 이 함수 호출이 끝나면 더 이상 참조를 유지하지 않는다 (서버 저장 없음).
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
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

export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
