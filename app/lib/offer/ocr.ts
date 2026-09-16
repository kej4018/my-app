import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

// 스캔본·사진 촬영본처럼 텍스트 레이어가 없는 PDF를 위한 이미지 글자 인식(OCR).
// tesseract.js는 브라우저/서버 안에서 직접 동작하는 라이브러리라, 스캔본 이미지가
// 외부 서비스로 전송되지 않는다 (PRD 7 "외부 공유·반출 금지" 원칙을 지키기 위한 선택).
//
// OCR은 네이티브 텍스트 추출보다 훨씬 느리고(페이지당 수 초) 완벽하지 않으므로,
// 텍스트 레이어가 있는 일반 PDF에는 절대 사용하지 않고, 텍스트가 거의 없을 때만 보조로 쓴다.

/** 한 페이지 이미지에서 한글+영문 텍스트를 인식한다 */
async function recognizeImage(image: Uint8Array): Promise<string> {
  const worker = await createWorker("kor+eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(Buffer.from(image));
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * PDF의 각 페이지를 이미지로 렌더링한 뒤 OCR로 텍스트를 뽑는다.
 * 스캔본에는 벡터로 그려진 표가 없으므로 표 인식(getTable)은 시도하지 않는다.
 */
export async function ocrPdfPages(buffer: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    // 해상도를 높일수록 인식률이 좋아지지만 느려진다. 문서 스캔본 기준으로 2배가 적당하다.
    const screenshots = await parser.getScreenshot({ scale: 2 });
    const texts: string[] = [];
    for (const page of screenshots.pages) {
      texts.push(await recognizeImage(page.data));
    }
    return texts;
  } finally {
    await parser.destroy();
  }
}

/** 한 페이지만 OCR이 필요할 때 사용한다 (급여명세서처럼 페이지별로 처리하는 경우) */
export async function ocrPdfPage(buffer: Buffer, pageNumber: number): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const screenshots = await parser.getScreenshot({ scale: 2, partial: [pageNumber] });
    const page = screenshots.pages[0];
    if (!page) return "";
    return recognizeImage(page.data);
  } finally {
    await parser.destroy();
  }
}
