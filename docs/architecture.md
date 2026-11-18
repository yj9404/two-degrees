# TwoDegrees 아키텍처

실제 코드 기준([`backend/main.py`](../backend/main.py), [`backend/database.py`](../backend/database.py), [`backend/utils/`](../backend/utils/), [`frontend/lib/api.ts`](../frontend/lib/api.ts), [`frontend/app/admin/page.tsx`](../frontend/app/admin/page.tsx)).

## 구성요소

| 레이어 | 기술 | 배포 | 비고 |
|---|---|---|---|
| 프론트엔드 | Next.js 15 (App Router), React 19, TS | **Vercel** (Hobby) | `@vercel/analytics`, `@vercel/speed-insights` |
| 백엔드 | FastAPI (단일 `main.py`), SQLAlchemy 2 | **GCP Cloud Run** (`asia-northeast3`) | 이미지: Artifact Registry |
| DB | PostgreSQL | **Neon** (무료) | 로컬은 SQLite(`twodegrees.db`) |
| 이미지 스토리지 | S3 호환 | **Cloudflare R2** | boto3 presigned URL, 브라우저가 직접 PUT |
| LLM | `google-genai` SDK | **Vertex AI** (`aiplatform`, location `global`) | 로컬 폴백: AI Studio(`GEMINI_API_KEY`) |
| 배치 스케줄 | **GCP Cloud Scheduler** | → `POST /api/internal/generate-daily` (`X-Scheduler-Secret`) | 일일 자동 매칭 |
| 인프로세스 스케줄 | APScheduler | Cloud Run 컨테이너 내 | 매월 1일 00:00 페널티 점수 리셋만 |
| 관리자 인증 | Google OAuth (`@react-oauth/google`) | → `POST /api/admin/login` → JWT(24h) | 허용 이메일 화이트리스트 |
| 알림/전달 | **없음 (수동)** | 관리자가 카카오톡으로 직접 | 카카오 채널은 문의용 외부 링크일 뿐, 시스템 통합 없음 |

## 시스템 다이어그램

```mermaid
flowchart TB
    user["👤 유저<br/>(모바일 웹)"]
    admin["🛠️ 관리자"]
    kakao["💬 카카오톡<br/>(관리자 개인 계정으로 수동 발송)"]

    subgraph vercel["Vercel — Next.js 15"]
        fe["프론트엔드<br/>/ · /register · /edit · /auth<br/>/matching-status · /p/[token]<br/>/notices · /admin"]
    end

    subgraph gcp["Google Cloud Platform"]
        subgraph run["Cloud Run (asia-northeast3)"]
            api["FastAPI (main.py)<br/>REST API + APScheduler(월 1회 페널티 리셋)"]
        end
        sched["Cloud Scheduler<br/>(일 1회)"]
        vertex["Vertex AI<br/>gemini-*-flash"]
    end

    neon[("Neon<br/>PostgreSQL")]
    r2[("Cloudflare R2<br/>이미지")]
    google["Google OAuth"]

    user -->|"HTTPS"| fe
    admin -->|"HTTPS"| fe
    fe -->|"lib/api.ts · NEXT_PUBLIC_API_URL"| api

    api <-->|"SQLAlchemy"| neon
    fe -.->|"1) presigned URL 요청"| api
    api -.->|"2) 서명 URL"| fe
    fe ==>|"3) PUT 원본 이미지 직접 업로드"| r2

    api -->|"AI 추천/평가"| vertex
    sched -->|"POST /api/internal/generate-daily"| api
    admin -->|"관리자 로그인 id_token"| google
    google -->|"검증"| api

    api -.->|"제안/연락처 메시지 + /p/token 링크<br/>(클립보드 복사)"| admin
    admin ==>|"메시지 수동 전송"| kakao
    kakao ==>|"링크 수신"| user
```

## 매칭 라이프사이클 (수동 전달 경로 포함)

```mermaid
sequenceDiagram
    actor A as 관리자
    participant API as FastAPI
    participant G as Vertex AI
    participant DB as Neon
    actor U as 유저 A/B
    participant K as 카카오톡(수동)

    Note over API,DB: (자동) Cloud Scheduler → /api/internal/generate-daily<br/>랜덤 이성 페어 → Gemini 평가 → 50점↑ 2쌍까지 PENDING 생성

    A->>API: POST /api/matchings/ai-recommend (타겟 vs 후보들)
    API->>G: 프로필 JSON (이름·연락처·사진 제외)
    G-->>API: [{candidate_id, score, reason}]
    API->>DB: AiRecommendHistory 캐시 저장
    A->>API: POST /api/matchings (쌍 확정)
    API->>DB: Matching 생성 (user_a_token / user_b_token)

    A->>API: PATCH /api/matchings/{id}/refresh-expiry
    API->>DB: expires_at = now + 24h
    API-->>A: 제안 메시지 + https://.../p/{token} (클립보드)
    A->>K: 메시지 붙여넣어 유저에게 전송
    K->>U: 링크 수신

    U->>API: GET /api/shared/{token}
    Note over U: 본인확인 모달(클라이언트) — recipient_name 대조
    API-->>U: 상대 프로필(연락처·이름·자기소개 원문 제외)
    U->>API: POST /api/shared/{token}/respond (ACCEPTED / REJECTED)
    API->>DB: user_x_status 갱신

    alt 양측 ACCEPTED
        A->>API: PATCH /api/matchings/{id}/contact-shared
        API->>DB: 두 유저 is_active=false
        API-->>A: "서로의 연락처 전달" 메시지(클립보드)
        A->>K: 각자에게 상대 연락처 수동 전송
    else 거절 / 무응답 만료
        A->>API: PATCH /api/matchings/{id}/contact-shared
        API->>DB: 거절 1.0 / 무응답 1.5 페널티, 누적 3.0↑ → 14일 정지
        A->>K: 종료 안내 메시지 수동 전송
    end
```

## 데이터 흐름 메모

- **이미지**: 백엔드를 경유하지 않는다. 브라우저가 `GET /api/upload/presigned-url`로 서명 URL만 받고 R2에 직접 PUT, 공개 URL을 `users.photo_urls`에 저장.
- **LLM 입력**: `utils/gemini.py`가 타겟+후보의 프로필 JSON에서 `name`·`referrer_name`·`photo_urls`를 제외하고 프롬프트에 임베드. 후보 ID는 `B1`, `B2` 라벨로 치환 후 응답에서 원복.
- **세션**: 일반 유저는 세션/토큰이 없다. 로그인은 `user_id` 반환뿐이고 이후 요청은 UUID로 식별. 관리자만 JWT(쿠키 저장).
- **자동 매칭 중복 방지**: 일일 매칭은 APScheduler가 아니라 Cloud Scheduler 단일 트리거로만 실행(컨테이너 다중 인스턴스 시 중복 생성 방지 목적, 코드 주석 명시).
