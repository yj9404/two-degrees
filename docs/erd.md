# TwoDegrees ERD

SQLAlchemy 모델([`backend/models.py`](../backend/models.py)) 기준. 주요 컬럼만 표기(전체 컬럼은 모델 파일 참조).

- DB: 로컬 SQLite / 운영 Neon PostgreSQL ([`backend/database.py`](../backend/database.py))
- ID: `users` / `matchings` / `ai_*` 는 애플리케이션 생성 UUIDv4 문자열(PK). `notices` 만 정수 auto-increment.
- 마이그레이션: Alembic 없음. 앱 시작 시 `Base.metadata.create_all` + `main.py` 내 수동 `ALTER TABLE`(idempotent).
- 모델에 `relationship()` 정의는 없고 `ForeignKey` 컬럼 제약만 존재. `ai_batch_recommend_histories` 는 유저 참조를 JSON 배열로만 보관(FK 없음).

```mermaid
erDiagram
    users ||--o{ matchings : "user_a_id"
    users ||--o{ matchings : "user_b_id"
    users ||--o{ ai_recommend_histories : "target_user_id (ON DELETE CASCADE)"

    users {
        string id PK "UUIDv4"
        string name
        enum gender "MALE | FEMALE"
        int birth_year
        string job
        string contact UK "로그인 식별자(전화/카톡ID)"
        string password_hash "bcrypt"
        string referrer_name "소개한 지인"
        text desired_conditions "원하는 조건(min 10자)"
        text deal_breakers "기피 조건(min 10자)"
        bool is_active "매칭풀 노출 여부"
        bool is_deleted "소프트 삭제(PII 초기화)"
        json photo_urls
        json age_preference "OLDER|YOUNGER|SAME|ANY"
        int age_gap_older
        int age_gap_younger
        enum smoking_status "nullable"
        enum drinking_status "nullable"
        enum marriage_intent "기본 UNKNOWN"
        enum child_plan "기본 UNKNOWN"
        float penalty_points "월초 리셋"
        float total_penalty_points "누적"
        int suspension_count
        datetime penalty_until "정지 해제 시각, nullable"
        bool has_agreed_penalty_policy
    }

    matchings {
        string id PK "UUIDv4"
        string user_a_id FK
        string user_b_id FK
        enum user_a_status "PENDING | ACCEPTED | REJECTED"
        enum user_b_status "PENDING | ACCEPTED | REJECTED"
        string user_a_token UK "token_urlsafe(32)"
        string user_b_token UK "token_urlsafe(32)"
        datetime expires_at "제안 발송 시 now+24h, nullable"
        int ai_score "nullable"
        text ai_reason "nullable"
        bool is_auto_generated "스케줄러 생성 여부"
        bool is_contact_shared "관리자 매칭 종료 처리 여부"
        datetime created_at
    }

    ai_recommend_histories {
        string id PK "UUIDv4"
        string target_user_id FK "indexed"
        json candidate_results "{candidate_id: {score, reason, ...}} — 타겟당 1행 병합·덮어쓰기"
        datetime created_at
    }

    ai_batch_recommend_histories {
        string id PK "UUIDv4"
        json target_ids "유저 ID 배열(FK 아님)"
        json candidate_ids "유저 ID 배열(FK 아님)"
        int top_n
        json results "[{rank, target_id, candidate_id, score, reason}]"
        datetime created_at
    }

    notices {
        int id PK "auto-increment"
        string title
        text content
        bool is_popup
        datetime created_at
    }
```

## 제약·인덱스

| 테이블 | 제약 |
|---|---|
| `users` | `contact` UNIQUE |
| `matchings` | `user_a_token` UNIQUE, `user_b_token` UNIQUE, `UNIQUE(user_a_id, user_b_id)` (`uq_matching_user_a_b`) — 매칭 생성 시 두 ID를 문자열 정렬해 저장 |
| `ai_recommend_histories` | `target_user_id` INDEX, FK `ON DELETE CASCADE` |

## Enum 값

| Enum | 값 |
|---|---|
| `Gender` | `MALE`, `FEMALE` |
| `MatchStatus` | `PENDING`, `ACCEPTED`, `REJECTED` |
| `SmokingStatus` | `NON_SMOKER`, `SMOKER` |
| `DrinkingStatus` | `NON_DRINKER`, `SOCIAL_DRINKER`, `DRINKER` |
| `MarriageIntent` | `UNKNOWN`, `WILLING`, `OPEN`, `NOT_NOW`, `NON_MARRIAGE` |
| `ChildPlan` | `UNKNOWN`, `WANT`, `OPEN`, `NOT_NOW`, `DINK` |
