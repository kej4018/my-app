import ExcelJS from "exceljs";
import officeCrypto from "officecrypto-tool";
import { GRADE_TABLE } from "./gradeTable";
import type { BenchmarkPeer } from "./types";

// 인사마스터(전 직원 정보) 파일에서 "동일 소속 재직자 처우 벤치마크"만 뽑아온다.
//
// 보안 주의: 이 파일의 "인사마스터" 시트에는 주민등록번호(7열)와 계좌은행/계좌번호(24~25열)처럼
// 이 기능과 무관한 고위험 개인정보도 함께 들어있다. 아래 COLUMNS는 화이트리스트이며,
// 여기 없는 열 번호는 이 파일의 어떤 함수에서도 읽지 않는다. 새 필드가 필요해지더라도
// 주민번호·계좌 관련 열은 절대 추가하지 않는다.
const COLUMNS = {
  name: 3,
  department: 4,
  position: 5, // 직위(사원/대리/과장 등)
  title: 6, // 직책(팀원/팀장 등)
  status: 10, // 근무상태
  education: 12,
  totalCareerYearsText: 20, // 예: "24년"
  currentAnnualExcludingMeal: 27, // 2026년 연봉 (식대 제외 기준)
} as const;

const DATA_START_ROW = 3;
const HEADER_ROW = 2;
const MAX_PEERS = 12;

export type MasterLookupResult =
  | { ok: true; peers: BenchmarkPeer[] }
  | { ok: false; message: string };

function parseCareerYears(text: string): number {
  const matched = String(text).match(/(\d+)/);
  return matched ? Number(matched[1]) : 0;
}

function gradeFromPosition(position: string): string {
  const rule = GRADE_TABLE.find((item) => position.includes(item.position));
  return rule?.grade ?? "";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const text = String(value ?? "").replace(/[,\s원]/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 암호로 보호된 인사마스터 엑셀을 열어 지정한 부서와 이름이 겹치는(포함 관계) 재직자만 골라낸다.
 * 파일 전체 내용은 이 함수 밖으로 나가지 않으며, 반환값은 화이트리스트 컬럼으로만 구성된다.
 */
export async function lookupDepartmentBenchmark(
  fileBuffer: Buffer,
  password: string,
  department: string,
  companyMealAllowanceMonthly: number,
): Promise<MasterLookupResult> {
  // officecrypto-tool / exceljs가 각자 다른 버전의 Buffer 타입 선언을 번들링하고 있어
  // 구조적으로 어긋나 보이지만, 런타임에는 동일한 Node Buffer를 그대로 주고받는다.
  let decrypted: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decrypted = await officeCrypto.decrypt(fileBuffer as any, { password });
  } catch {
    return { ok: false, message: "인사마스터 파일의 암호가 올바르지 않습니다." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(decrypted as any);
  } catch {
    return { ok: false, message: "인사마스터 파일을 열지 못했습니다. 형식을 확인해 주세요." };
  }

  const sheet = workbook.getWorksheet("인사마스터");
  if (!sheet) {
    return { ok: false, message: "'인사마스터' 시트를 찾지 못했습니다." };
  }

  const headerRow = sheet.getRow(HEADER_ROW);
  const departmentHeader = String(headerRow.getCell(COLUMNS.department).text ?? "").trim();
  if (departmentHeader !== "부서") {
    return {
      ok: false,
      message: "인사마스터 시트 구조가 예상과 달라 안전하게 읽을 수 없습니다.",
    };
  }

  const query = department.trim();
  if (!query) return { ok: true, peers: [] };

  const peers: BenchmarkPeer[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < DATA_START_ROW || peers.length >= MAX_PEERS) return;

    const status = String(row.getCell(COLUMNS.status).text ?? "").trim();
    if (status !== "재직") return;

    const dept = String(row.getCell(COLUMNS.department).text ?? "").trim();
    if (!dept) return;
    if (!dept.includes(query) && !query.includes(dept)) return;

    const position = String(row.getCell(COLUMNS.position).text ?? "").trim();
    const annualExcludingMeal = toNumber(row.getCell(COLUMNS.currentAnnualExcludingMeal).value);
    if (annualExcludingMeal <= 0) return;

    peers.push({
      name: String(row.getCell(COLUMNS.name).text ?? "").trim(),
      department: dept,
      grade: gradeFromPosition(position),
      title: String(row.getCell(COLUMNS.title).text ?? "").trim(),
      careerYears: parseCareerYears(row.getCell(COLUMNS.totalCareerYearsText).text ?? ""),
      education: String(row.getCell(COLUMNS.education).text ?? "").trim(),
      annualExcludingMeal,
      annualIncludingMeal: annualExcludingMeal + companyMealAllowanceMonthly * 12,
    });
  });

  return { ok: true, peers };
}
