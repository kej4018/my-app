// 데모 계정 2개(관리자 / 일반 사용자)를 생성하는 스크립트.
//
// 실행: node --env-file=.env scripts/seed-users.mjs
//
// - email_confirm: true 로 만들기 때문에 확인 메일이 한 통도 발송되지 않는다.
//   (Supabase 기본 메일은 시간당 2통 제한이 있어 초대 메일 방식은 쓰지 않는다)
// - 역할은 app_metadata.role 에 저장한다. 이 값은 사용자가 직접 바꿀 수 없어
//   권한 판단에 쓰기 적합하다. (user_metadata 는 사용자가 수정 가능하므로 사용 금지)
// - 비밀번호는 .env 에서 읽으며 화면에 출력하지 않는다.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const accounts = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@jeisys.com",
    password: process.env.SEED_ADMIN_PASSWORD,
    role: "admin",
    label: "관리자",
  },
  {
    email: process.env.SEED_USER_EMAIL ?? "recruiter@jeisys.com",
    password: process.env.SEED_USER_PASSWORD,
    role: "user",
    label: "일반 사용자(채용담당자)",
  },
];

function checkEnv() {
  const missing = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!secretKey) missing.push("SUPABASE_SECRET_KEY");
  accounts.forEach((account, index) => {
    if (!account.password) {
      missing.push(index === 0 ? "SEED_ADMIN_PASSWORD" : "SEED_USER_PASSWORD");
    }
  });

  if (missing.length > 0) {
    console.error(`.env 에 다음 항목이 필요합니다: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function main() {
  checkEnv();

  // 비밀 키는 서버에서만 사용한다. 세션을 저장하거나 갱신하지 않도록 설정한다.
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: { role: account.role },
    });

    if (error) {
      // 이미 있는 계정이면 역할만 최신 상태로 맞춘다
      if (error.status === 422 || /already/i.test(error.message)) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users.find((user) => user.email === account.email);

        if (existing) {
          await admin.auth.admin.updateUserById(existing.id, {
            app_metadata: { role: account.role },
          });
          console.log(`이미 존재 → 역할 갱신 완료: ${account.email} (${account.label})`);
          continue;
        }
      }
      console.error(`생성 실패: ${account.email} — ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`생성 완료: ${data.user.email} (${account.label})`);
  }
}

main();
