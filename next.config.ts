import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse(pdfjs-dist)는 PDF 파싱용 워커 파일을 동적으로 불러오는데,
  // 번들러가 이 파일을 처리하면 경로가 어긋나 "fake worker" 설정에 실패한다.
  // 서버 전용 패키지로 지정해 번들링 대상에서 제외하고 Node가 직접 불러오게 한다.
  // tesseract.js도 워커·wasm·언어팩 파일을 동적으로 불러오므로 같은 이유로 제외한다.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js"],
};

export default nextConfig;
