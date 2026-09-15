import { requireUser } from "../lib/auth/guard";
import OfferClient from "./offer-client";

// 로그인 상태에 따라 화면이 달라지므로 캐시하지 않는다
export const dynamic = "force-dynamic";

export default async function OfferPage() {
  const user = await requireUser("/offer");

  // 인사마스터 벤치마크는 전 직원 급여·주민번호·계좌번호가 담긴 파일을 다루므로 관리자만 사용한다
  return <OfferClient canUseBenchmark={user.role === "admin"} />;
}
