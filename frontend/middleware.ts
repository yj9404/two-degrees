import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CLOSED_PATH = "/closed";

// 서비스 종료: 모든 경로를 종료 안내 페이지로 보낸다.
// 기본값은 "종료" — 배포 환경에 변수를 따로 넣지 않아도 닫힌 상태가 유지되도록 한다.
// 로컬에서 시드 데이터로 화면을 재현할 때만 SERVICE_CLOSED=false 로 끈다.
const isServiceClosed = process.env.SERVICE_CLOSED !== "false";

export function middleware(request: NextRequest) {
  if (!isServiceClosed || request.nextUrl.pathname === CLOSED_PATH) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = CLOSED_PATH;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // 정적 리소스와 메타데이터 이미지는 그대로 서빙한다.
  matcher: ["/((?!_next/static|_next/image|_vercel|favicon.ico|icon.png|opengraph-image.png).*)"],
};
