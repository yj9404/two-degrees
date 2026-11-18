# 기술 스택 스냅샷

서비스 종료 시점(2026-08) 기준. 버전은 **실제 설치/lockfile에서 해석된 값**, 괄호는 매니페스트에 적힌 스펙.
> 선택 이유는 추후 직접 채울 것. 여기서는 목록만.

## 백엔드 — `backend/`

- 런타임: **Python 3.14** (`.venv`), 배포 `Dockerfile`
- 매니페스트: [`requirements.txt`](../backend/requirements.txt) (핀 없이 `>=`)
- 앱 구조: 단일 파일 `main.py`(~2,300줄) + `models.py` / `schemas.py` / `database.py` / `utils/{gemini,s3}.py`

| 패키지 | 설치 버전 | 스펙 | 역할 |
|---|---|---|---|
| fastapi | 0.135.1 | `>=0.115.0` | 웹 프레임워크 |
| starlette | 0.52.1 | (fastapi 의존) | ASGI 토대 |
| uvicorn[standard] | 0.41.0 | `>=0.30.0` | ASGI 서버 |
| pydantic | 2.12.5 | `>=2.0.0` | 스키마·검증 (v2) |
| SQLAlchemy | 2.0.48 | `>=2.0.0` | ORM |
| psycopg2-binary | 2.9.11 | `>=2.9.9` | PostgreSQL 드라이버 (운영) |
| bcrypt | 5.0.0 | `>=4.0.0` | 유저 비밀번호 해시 (passlib 미사용, 직접 호출) |
| PyJWT | 2.11.0 | `>=2.8.0` | 관리자 JWT 발급·검증 |
| google-auth | 2.49.0 | `>=2.29.0` | Google OAuth ID 토큰 검증 |
| google-genai | 1.66.0 | (핀 없음) | Gemini SDK (Vertex AI / AI Studio) |
| boto3 / botocore | 1.42.62 | `>=1.34.0` | R2(S3 호환) presigned URL |
| APScheduler | 3.11.2 | `>=3.10.0` | 인프로세스 월간 페널티 리셋 |
| httpx | 0.28.1 | `>=0.27.0` | HTTP 클라이언트 |
| python-dotenv | 1.2.2 | `>=1.0.0` | `.env` 로드 |
| anyio | 4.12.1 | (fastapi 의존) | 비동기 |

- 테스트: `pytest` (`backend/tests/`)
- 마이그레이션 도구: **없음** (Alembic 미사용, `create_all` + 수동 `ALTER TABLE`)

## 프론트엔드 — `frontend/`

- 런타임: Node.js (Vercel 빌드), Next.js **15.5.12** App Router
- 매니페스트: [`package.json`](../frontend/package.json) / lock: `package-lock.json`
- `version`: 0.3.0

| 패키지 | 해석 버전 | 스펙 | 역할 |
|---|---|---|---|
| next | 15.5.12 | `^15.5.12` | 프레임워크 (App Router) |
| react / react-dom | 19.2.3 | `19.2.3` (핀) | UI 런타임 |
| typescript | 5.9.3 | `^5` | 타입 |
| tailwindcss | 4.2.1 | `^4` | 스타일 (`@tailwindcss/postcss` 4.2.1) |
| shadcn | 3.8.5 | `^3.8.5` | 컴포넌트 스캐폴딩 CLI |
| radix-ui | 1.4.3 | `^1.4.3` | 헤드리스 UI 프리미티브 |
| lucide-react | 0.576.0 | `^0.576.0` | 아이콘 |
| class-variance-authority | 0.7.1 | `^0.7.1` | 베리언트 클래스 |
| clsx | 2.1.1 | `^2.1.1` | 클래스 병합 |
| tailwind-merge | 3.5.0 | `^3.5.0` | Tailwind 클래스 충돌 해소 |
| tw-animate-css | 1.4.0 | `^1.4.0` | 애니메이션 유틸 |
| date-fns | 4.1.0 | `^4.1.0` | 날짜 포매팅 |
| @react-oauth/google | 0.13.5 | `^0.13.5` | 관리자 Google 로그인 |
| @vercel/analytics | 2.0.1 | `^2.0.1` | 방문 분석 |
| @vercel/speed-insights | 2.0.0 | `^2.0.0` | 성능 측정 |

- 린트: `eslint` 9.39.3 + `eslint-config-next` 15.3.0
- 테스트: `node --test` (`frontend/tests/*.test.ts`)

## 인프라 / 외부 서비스

| 항목 | 서비스 | 플랜 |
|---|---|---|
| 프론트 호스팅 | Vercel | Hobby |
| 백엔드 호스팅 | GCP Cloud Run (`asia-northeast3`) | 무료 크레딧 |
| 컨테이너 레지스트리 | GCP Artifact Registry | 종량 |
| DB | Neon PostgreSQL | 무료 |
| 이미지 스토리지 | Cloudflare R2 | 무료 10GB |
| LLM | GCP Vertex AI (`gemini-2.5-flash` → `gemini-3.6-flash`) | 종량(후불) |
| 배치 트리거 | GCP Cloud Scheduler | 무료 |
| 관리자 인증 | Google OAuth 2.0 | — |
| 고객 문의 | 카카오톡 채널 (링크만) | — |
