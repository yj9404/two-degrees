import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CLOSED_PATH = "/closed";

// 서비스 종료: 모든 경로를 종료 안내 페이지로 보낸다.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === CLOSED_PATH) {
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
