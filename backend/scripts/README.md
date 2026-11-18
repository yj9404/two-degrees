# seed_demo.py — 포트폴리오 스크린샷용 데모 시드 데이터

실제 유저 데이터를 폐기하기 전, 포트폴리오/데모 스크린샷 용도로 가짜 유저 12명과
매칭 3쌍을 만들어 화면을 채우는 스크립트입니다.

## 사전 준비

1. **로컬 SQLite로 실행할 것.** `backend/.env`에 `DATABASE_URL`이 설정되어 있다면
   반드시 비우거나 `sqlite:///./twodegrees.db` 형태인지 확인하세요. Postgres(Neon) 등
   SQLite가 아닌 DB가 감지되면 스크립트가 즉시 중단됩니다 (운영 DB 오염 방지).
2. **`GEMINI_API_KEY`가 설정되어 있을 것.** 매칭 3쌍의 추천 사유(ai_reason)는 실제
   Gemini API를 호출해 생성합니다. `GOOGLE_CLOUD_PROJECT`가 설정되어 있으면(Vertex AI =
   운영 설정) 스크립트가 중단되므로, 로컬에서는 `GEMINI_API_KEY`만 사용하세요.
3. **한 번 이상 서버를 띄워 스키마를 최신 상태로 맞춰둘 것.**
   ```bash
   cd backend
   uvicorn main:app --reload --port 8000
   ```
   `main.py`가 시작 시 컬럼 마이그레이션(`_run_migrations`)을 자동 적용합니다. 이 스크립트
   자체는 테이블이 아예 없을 때만 생성(`create_all`)하며, 기존 테이블에 컬럼을 추가하는
   마이그레이션은 수행하지 않습니다.
4. `seed_photos/manifest.json` 및 `seed_photos/seed_{m,f}0{1-6}.png` 12장이 준비되어 있을 것.
   시드 사진은 로컬 전용이라 저장소에 포함되지 않습니다(`.gitignore`). 직접 준비한 사진과
   manifest(`id`·`gender`·`apparent_age`·`filename`·`description`)를 넣어 두세요.
   사진을 교체했다면 `python scripts/normalize_seed_photos.py`로 3:4 PNG 정규화 및
   manifest 갱신 (기존 `apparent_age`/`description` 값은 보존).

## 실행

```bash
cd backend
python scripts/seed_demo.py
```

수행 내용:

- `seed_photos/*.png` → `frontend/public/seed-photos/`로 복사 (R2/S3 자격 증명 불필요,
  Next.js가 `/seed-photos/xxx.png` 상대 경로로 바로 서빙합니다).
- 유저 12명 생성 (contact: `seed-{id}@seed.local`, 공통 비밀번호: `SeedDemo1234!`).
- 실제 Gemini API 호출로 남성 3명(m01/m02/m03) 기준 여성 후보 풀에서 최고 점수 상대를
  찾아 매칭 3쌍 생성, `AiRecommendHistory`에 실제 운영과 동일한 형식으로 캐시 적재.
- 3쌍은 서로 다른 진행 단계로 생성됩니다:
  1. **추천/매칭 생성됨** — 링크 미발급 (`expires_at = NULL`)
  2. **링크 발급, 미열람** — 콘솔에 출력되는 `/p/{token}` 링크를 브라우저로 열면
     "본인 확인" 모달을 캡처할 수 있습니다.
  3. **링크 발급 + 응답 완료** — 양측 `ACCEPTED` 상태로 성사된 매칭 화면을 캡처할 수 있습니다.

이미 시드 유저/매칭이 존재하면 해당 단계는 건너뛰고 재사용합니다. 즉, Gemini 호출 실패
등으로 중간에 멈춰도 다시 실행하면 이어서 진행됩니다.

## 롤백

```bash
python scripts/seed_demo.py --purge        # 확인 프롬프트 있음
python scripts/seed_demo.py --purge --yes  # 확인 없이 즉시 삭제
```

`seed-*@seed.local` contact를 가진 유저와, 그 유저가 얽힌 매칭/AI 추천 이력만 삭제합니다.
실제 유저 데이터는 이 마커를 가질 수 없으므로 절대 영향을 받지 않습니다.
`frontend/public/seed-photos/`도 함께 삭제합니다.

## 알림(카카오톡/이메일/푸시) 관련

코드베이스 전체를 확인했지만 실제 알림을 발송하는 코드 경로는 아직 존재하지 않습니다
(관리자 로그인에 쓰이는 `ALLOWED_ADMIN_EMAILS`만 있을 뿐, 발신 로직은 없음). 또한 이
스크립트는 FastAPI 엔드포인트를 거치지 않고 SQLAlchemy 세션으로 직접 데이터를 쓰기
때문에, 추후 엔드포인트 안에 알림 발송 코드가 추가되더라도 이 스크립트 실행으로는
트리거되지 않습니다.

## 안전장치 요약

- Cloud Run 환경변수(`K_SERVICE`/`K_REVISION`), `GOOGLE_CLOUD_PROJECT`(Vertex AI 운영 설정),
  SQLite가 아닌 `DATABASE_URL` 중 하나라도 감지되면 즉시 중단.
- 모든 조회/삭제 쿼리가 `seed-*@seed.local` 마커로 한정되어 있어 실제 유저 데이터를
  건드릴 수 없음.
- 기존 유저는 절대 삭제하지 않음 (`--purge`도 시드 마커 대상만 삭제).
