# TwoDegrees API 요약

- 원본 스펙: [`openapi.json`](./openapi.json) — 실행 중인 FastAPI(`GET /openapi.json`)에서 추출
- API 제목/버전: **TwoDegrees API v1.0.4** · OpenAPI 3.1.0
- 총 **32개 오퍼레이션 / 26개 경로** (+ OpenAPI 비공개 내부 엔드포인트 1개)
- Base URL(운영): GCP Cloud Run · 로컬: `http://localhost:8000` · Swagger UI: `/docs`

## 인증 모델

| 표기 | 의미 | 검증 방식 |
|---|---|---|
| 🔓 | 인증 없음 | 누구나 호출 |
| 🔑 | 본문 자격증명 | 요청 body의 `contact`+`password`(또는 `current_password`) 검증 |
| 🎫 | 역량 토큰 | URL의 추측 불가능한 토큰(`user_a_token`/`user_b_token`, `secrets.token_urlsafe(32)`) + 만료·상태 조건 |
| 🔒 | 관리자 JWT | `Authorization: Bearer <JWT>` — `POST /api/admin/login`(Google OAuth)으로 발급, 유효기간 24h |
| 🗝️ | 스케줄러 시크릿 | `X-Scheduler-Secret` 헤더 == 서버 `SCHEDULER_SECRET` |

> ⚠️ `PUT /api/users/{user_id}`, `PATCH /api/users/{user_id}/agree-policy` 는 인증이 없어 `user_id`(UUID)만 알면 호출 가능하다. 프로필 수정은 UUID 소유(=본인만 링크를 앎)에 의존한다.

---

## 사용자용 (public)

| 인증 | 메서드 | 경로 | 용도 |
|---|---|---|---|
| 🔓 | POST | `/api/users` | 소개팅 풀 등록(회원가입). `password`는 bcrypt 해시 저장, `contact` 중복 차단 |
| 🔑 | POST | `/api/users/auth` | 로그인. `contact`+`password` 검증 후 `user_id`·`name` 반환(세션/토큰 없음) |
| 🔓 | GET | `/api/users/stats` | 활성 유저 남/녀 수·비율 (랜딩 페이지 라이브 통계) |
| 🔓 | GET | `/api/users/{user_id}` | 단일 유저 조회 (프로필 수정 화면 prefill) |
| 🔓 | PUT | `/api/users/{user_id}` | 프로필 부분 수정 (`is_active` 토글 포함). 수정 시 관련 AI 추천 이력 정리 |
| 🔓 | PATCH | `/api/users/{user_id}/agree-policy` | 페널티 정책 동의 기록 |
| 🔑 | PATCH | `/api/users/{user_id}/change-password` | 비밀번호 변경 (`current_password` 확인) |
| 🔑 | DELETE | `/api/users/{user_id}/self` | 본인 계정 삭제 (`contact`+`password` 확인, 소프트 삭제 + PII 초기화) |
| 🔓 | GET | `/api/upload/presigned-url` | 이미지 업로드용 S3/R2 Presigned URL 발급 (`image/jpeg\|png\|webp`, 5분 유효) |
| 🔓 | GET | `/api/notices` | 공지사항 목록 (전체 공개) |
| 🔓 | GET | `/api/notices/latest-popup` | 최근 팝업 공지 1건 (없으면 `null`) |
| 🔓 | GET | `/api/matchings/stats/daily` | 날짜별 매칭 생성 건수 통계 |

## 공유 프로필 (역량 토큰)

| 인증 | 메서드 | 경로 | 용도 |
|---|---|---|---|
| 🎫 | GET | `/api/shared/{token}` | 매칭 상대의 제한된 프로필 조회. 만료(24h) 또는 이미 응답 시 차단. 연락처·이름·자기소개 원문 제외 |
| 🎫 | POST | `/api/shared/{token}/respond` | 매칭 수락(`ACCEPTED`)/거절(`REJECTED`) 응답 |

## 관리자용 (Admin JWT)

| 인증 | 메서드 | 경로 | 용도 |
|---|---|---|---|
| 🔓 | POST | `/api/admin/login` | Google ID 토큰 검증 → 허용 이메일이면 JWT 발급 |
| 🔒 | GET | `/api/users` | 유저 목록 (성별·연령·지역·흡연·음주·종교·MBTI·키·결혼/자녀관·희망나이 교차 필터) |
| 🔒 | DELETE | `/api/users/{user_id}` | 유저 소프트 삭제 (PII 초기화, 목록 제외) |
| 🔒 | POST | `/api/admin/users/{user_id}/reset-password` | 유저 비밀번호 초기화 |
| 🔒 | PATCH | `/api/admin/users/{user_id}/penalty` | 페널티 점수·정지 수동 수정 |
| 🔒 | POST | `/api/matchings` | 두 유저를 지정해 수동 매칭 생성 (진행 중 매칭/중복 쌍 차단) |
| 🔒 | GET | `/api/matchings` | 전체 매칭 조회 (`status_filter` 옵션) |
| 🔒 | PUT | `/api/matchings/{matching_id}/status` | 특정 유저의 매칭 상태 수동 변경 |
| 🔒 | DELETE | `/api/matchings/{matching_id}` | 매칭 삭제 |
| 🔒 | PATCH | `/api/matchings/{matching_id}/refresh-expiry` | 매칭 링크 만료 기한을 현재+24h로 설정 (최초 1회) |
| 🔒 | PATCH | `/api/matchings/{matching_id}/contact-shared` | 매칭 종료 처리 — 양측 수락 시 두 유저 비활성화, 거절·무응답 시 페널티(거절 1.0 / 무응답 1.5, 누적 3.0↑ 시 14일 정지) |
| 🔒 | POST | `/api/matchings/ai-recommend` | 타겟 1명 vs 후보 N명 Gemini 적합도 평가 (기매칭·진행중·동일 추천인·정지 유저 제외, 최근 이력 캐시 재사용) |
| 🔒 | POST | `/api/matchings/ai-batch-recommend` | 타겟 N명 vs 후보 M명 배치 평가 + Greedy Assignment로 상위 `top_n` 쌍 |
| 🔒 | GET | `/api/matchings/ai-recommend/history` | AI 추천 이력 조회 (`target_user_id` 필터) |
| 🔒 | POST | `/api/matchings/generate-daily` | 일일 자동 매칭 로직 즉시 실행 (스케줄러와 동일 로직) |
| 🔒 | POST | `/api/notices` | 공지사항 작성 |
| 🔒 | PUT | `/api/notices/{notice_id}` | 공지사항 수정 |
| 🔒 | DELETE | `/api/notices/{notice_id}` | 공지사항 삭제 |

## 내부용 (OpenAPI 비공개 · `include_in_schema=False`)

| 인증 | 메서드 | 경로 | 용도 |
|---|---|---|---|
| 🗝️ | POST | `/api/internal/generate-daily` | GCP Cloud Scheduler 전용. 활성 남녀 풀에서 랜덤 페어를 Gemini로 평가해 50점 이상 커플 최대 2쌍을 `PENDING`으로 생성 |
