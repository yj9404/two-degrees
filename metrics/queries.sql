-- ============================================================================
-- TwoDegrees(투디그리) — 서비스 종료 전 포트폴리오용 익명 집계 지표
-- 대상 : PostgreSQL (Neon) 운영 DB
-- 실행 : Neon 콘솔 SQL Editor 에 [Qn] 블록을 하나씩 복사해 실행하고
--        결과를 번호(Q1, Q2, ...)로 대조
--
-- 【공통 규칙】
--   * 전 쿼리 SELECT 전용. INSERT / UPDATE / DELETE / DDL 없음.
--   * 개인 식별 정보(이름·이메일·전화·인스타·사진 경로·자기소개 원문·user_id)
--     는 출력하지 않음. 집계 수치와 분포만 반환.
--   * 인원 5명 미만 셀은 '<5' 로 마스킹하거나 '기타' 로 합산.
--   * 기준 연도 = 2026 (백엔드 상수와 동일).
--       - 만 나이            = 2026 - birth_year        (공유 프로필 표시용)
--       - 매칭 로직의 한국식 나이 = 2026 - birth_year + 1  (나이 선호 판정용)
--   * 삭제 유저 제외 = is_deleted IS NOT TRUE   (FALSE 및 NULL 포함)
--     (삭제 시 gender/birth_year 는 남고 지역·선호·사진 등은 NULL 로 초기화됨)
--   * "운영 DB에 시드 계정 없음" 전제이므로 시드 제외 조건은 넣지 않음.
--
-- 【스키마 확인 결과 — 측정 가능 / 불가 구분】
--   테이블: users / matchings / ai_recommend_histories /
--           ai_batch_recommend_histories / notices
--
--   ✅ 측정 가능
--     - 가입 규모, 성별/연령/지역 분포                     (users)
--     - 매칭쌍 생성 → 제안 발송 → 응답 → 수락 → 연락처 전달  (matchings)
--     - 1인당 조건 충족 후보 수(근사), 후보 0명 비율          (users 자기조인)
--     - 추천 타겟 미수혜 유저 비율                          (ai_recommend_histories 등)
--     - AI 적합도 점수 분포                                 (matchings.ai_score + candidate_results)
--     - 월별 매칭 생성 추이(누적)                           (matchings.created_at)
--     - 연락처(수동) 전달 건수                              (matchings.is_contact_shared)
--     - 월별 배치 추천 실행 수                              (ai_batch_recommend_histories.created_at)
--
--   ❌ 측정 불가 (컬럼 부재 — 각 Q 에서 사유 명시, 추정 없이 '측정 불가' 반환)
--     - 월별 신규 가입 수 / 가입 누적
--         → users 에 created_at·가입일시 컬럼 없음. id 는 시간정보 없는 랜덤 UUID(uuid4).
--     - 가입 → 프로필 완성 소요 시간
--         → 위 + 프로필 등록이 단일 POST /api/users 라 '완성' 전이 이벤트가 없음.
--     - 가입 후 7일 / 30일 재활동 비율
--         → 로그인·접속·최종활동 로그 없음 (POST /api/users/auth 는 검증만, 기록 없음).
--     - 퍼널의 '링크 열람' / '본인확인 통과' / '프로필 열람' 수
--         → GET /api/shared/{token} 는 조회만 하고 기록 없음.
--           본인확인은 프런트엔드 클라이언트에서만 처리(서버 미기록).
--           측정 가능한 첫 사후 이벤트는 '응답(수락/거절)' 이며 이는 열람·본인확인의 하한.
--     - 총 LLM 호출 수 / 캐시 히트율 / 추천 1건당 토큰
--         → 호출 로그 테이블 없음, 토큰 usage 컬럼 없음(utils/gemini.py 미영속).
--           AiRecommendHistory 는 타겟별 1행을 병합·덮어쓰기 → 시도/히트 횟수 복원 불가.
--     - 연락처 요청 → 전달까지 소요 시간
--         → is_contact_shared 는 불리언 플래그만, 전환 시각(shared_at 등) 미기록.
--
-- 【실행 순서 팁】 Q8 / Q9 는 활성 유저 자기조인(O(n^2))이라 가장 무겁습니다. 맨 뒤에 실행.
-- ============================================================================


-- ============================================
-- [Q1] 전체 가입자 수
-- 목적: 서비스 총 규모
-- 예상 결과: 1행. total_all, total_excl_deleted, deleted
-- ============================================
SELECT
  count(*)                                       AS total_all,
  count(*) FILTER (WHERE is_deleted IS NOT TRUE)  AS total_excl_deleted,
  count(*) FILTER (WHERE is_deleted IS TRUE)      AS deleted
FROM users;


-- ============================================
-- [Q2] 유저 상태 분해
-- 목적: 규모의 내부 구성(현재 살아있는 풀 / 이탈·매칭종료 / 정지 / 사진 보유)
-- 예상 결과: 1행. registered, active_in_pool, deactivated, currently_suspended, has_photo
-- 비고: active_in_pool = is_active(매칭풀 노출). 양측 수락·연락처 전달 시 두 유저 모두 is_active=FALSE 로 전환됨.
-- ============================================
SELECT
  count(*) FILTER (WHERE is_deleted IS NOT TRUE)                                   AS registered,
  count(*) FILTER (WHERE is_deleted IS NOT TRUE AND is_active)                     AS active_in_pool,
  count(*) FILTER (WHERE is_deleted IS NOT TRUE AND NOT is_active)                 AS deactivated,
  count(*) FILTER (WHERE is_deleted IS NOT TRUE
                    AND penalty_until IS NOT NULL AND penalty_until > now())       AS currently_suspended,
  count(*) FILTER (WHERE is_deleted IS NOT TRUE
                    AND CASE WHEN jsonb_typeof(photo_urls::jsonb) = 'array'
                             THEN jsonb_array_length(photo_urls::jsonb) ELSE 0 END > 0) AS has_photo
FROM users;


-- ============================================
-- [Q3] 통합 퍼널 (유저 단위 · 단계별 distinct 유저 수)
-- 목적: 가입 → 프로필 → 추천 → 제안 발송 → (열람/본인확인) → 응답 → 수락 → 연락처 전달
-- 예상 결과: 10행 (stage, users). users 컬럼은 text — 측정 불가 단계는 '측정불가' 문자열.
-- 주의:
--   * 03~05 단계는 '관리자 액션'에 의해 진행됨(유저 자발적 이탈이 아님).
--   * 06 링크열람 / 07 본인확인통과 는 서버 미기록 → '측정불가'.
--     08 응답완료 가 06·07 의 하한(응답했으면 반드시 열람·본인확인을 거침).
-- ============================================
WITH u AS (
  SELECT id FROM users WHERE is_deleted IS NOT TRUE
),
photo AS (
  SELECT id FROM users
  WHERE is_deleted IS NOT TRUE
    AND CASE WHEN jsonb_typeof(photo_urls::jsonb) = 'array'
             THEN jsonb_array_length(photo_urls::jsonb) ELSE 0 END > 0
),
targeted AS (
  SELECT target_user_id AS uid FROM ai_recommend_histories
  UNION
  SELECT x FROM ai_batch_recommend_histories t,
         LATERAL jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(t.target_ids::jsonb) = 'array'
                THEN t.target_ids::jsonb ELSE '[]'::jsonb END
         ) AS x
),
matched AS (
  SELECT user_a_id AS uid FROM matchings
  UNION SELECT user_b_id FROM matchings
),
proposed AS (
  SELECT user_a_id AS uid FROM matchings WHERE expires_at IS NOT NULL
  UNION SELECT user_b_id FROM matchings WHERE expires_at IS NOT NULL
),
responded AS (
  SELECT user_a_id AS uid FROM matchings WHERE user_a_status::text <> 'PENDING'
  UNION SELECT user_b_id FROM matchings WHERE user_b_status::text <> 'PENDING'
),
accepted AS (
  SELECT user_a_id AS uid FROM matchings WHERE user_a_status::text = 'ACCEPTED'
  UNION SELECT user_b_id FROM matchings WHERE user_b_status::text = 'ACCEPTED'
),
shared AS (
  SELECT user_a_id AS uid FROM matchings WHERE is_contact_shared
  UNION SELECT user_b_id FROM matchings WHERE is_contact_shared
)
SELECT '01_가입'                          AS stage, count(*)::text                               AS users FROM u
UNION ALL SELECT '02_사진 등록(충실도 프록시)', count(*)::text                                    FROM photo
UNION ALL SELECT '03_AI 추천 타겟',           (SELECT count(DISTINCT uid)::text FROM targeted WHERE uid IN (SELECT id FROM u))
UNION ALL SELECT '04_매칭쌍 생성',            (SELECT count(DISTINCT uid)::text FROM matched   WHERE uid IN (SELECT id FROM u))
UNION ALL SELECT '05_제안 메시지 발송',        (SELECT count(DISTINCT uid)::text FROM proposed  WHERE uid IN (SELECT id FROM u))
UNION ALL SELECT '06_링크 열람',              '측정불가'
UNION ALL SELECT '07_본인확인 통과',           '측정불가'
UNION ALL SELECT '08_응답 완료(06·07 하한)',   (SELECT count(DISTINCT uid)::text FROM responded WHERE uid IN (SELECT id FROM u))
UNION ALL SELECT '09_수락',                  (SELECT count(DISTINCT uid)::text FROM accepted  WHERE uid IN (SELECT id FROM u))
UNION ALL SELECT '10_연락처 전달 완료',        (SELECT count(DISTINCT uid)::text FROM shared    WHERE uid IN (SELECT id FROM u))
ORDER BY stage;


-- ============================================
-- [Q4] 매칭쌍 단위 퍼널
-- 목적: 매칭 1건이 어디까지 진행됐는지 (matchings 테이블 기준, 실측 데이터)
-- 예상 결과: 1행.
--   pairs_created, proposal_sent, at_least_one_response, both_responded,
--   both_accepted, contact_shared, ai_auto_generated, admin_manual
-- 비고: proposal_sent = expires_at 설정됨(관리자가 제안 메시지 복사 시 1회 설정).
-- ============================================
SELECT
  count(*)                                                                                      AS pairs_created,
  count(*) FILTER (WHERE expires_at IS NOT NULL)                                                 AS proposal_sent,
  count(*) FILTER (WHERE user_a_status::text <> 'PENDING' OR  user_b_status::text <> 'PENDING')  AS at_least_one_response,
  count(*) FILTER (WHERE user_a_status::text <> 'PENDING' AND user_b_status::text <> 'PENDING')  AS both_responded,
  count(*) FILTER (WHERE user_a_status::text =  'ACCEPTED' AND user_b_status::text =  'ACCEPTED') AS both_accepted,
  count(*) FILTER (WHERE is_contact_shared)                                                      AS contact_shared,
  count(*) FILTER (WHERE is_auto_generated)                                                      AS ai_auto_generated,
  count(*) FILTER (WHERE NOT is_auto_generated)                                                  AS admin_manual
FROM matchings;


-- ============================================
-- [Q5] 성별 비율
-- 목적: 매칭풀 성비 불균형 (종료 사유 핵심 지표)
-- 예상 결과: 1~2행 (MALE / FEMALE).
--   gender, registered, active_in_pool, pct_registered, pct_active
-- ============================================
SELECT
  gender::text                                                                          AS gender,
  count(*)                                                                              AS registered,
  count(*) FILTER (WHERE is_active)                                                      AS active_in_pool,
  round(100.0 * count(*) / NULLIF(SUM(count(*)) OVER (), 0), 1)                          AS pct_registered,
  round(100.0 * count(*) FILTER (WHERE is_active)
        / NULLIF(SUM(count(*) FILTER (WHERE is_active)) OVER (), 0), 1)                  AS pct_active
FROM users
WHERE is_deleted IS NOT TRUE
GROUP BY gender
ORDER BY gender;


-- ============================================
-- [Q6] 연령대 분포 (5세 단위 · 성별 교차)
-- 목적: 풀의 연령 편중 확인
-- 나이 기준: 만 나이 = 2026 - birth_year
-- 예상 결과: 약 8~20행 (gender × age_band). 5명 미만 셀은 n='<5'.
-- ============================================
WITH bucketed AS (
  SELECT
    gender::text                  AS gender,
    ((2026 - birth_year) / 5) * 5 AS age_lo,
    count(*)                      AS cnt
  FROM users
  WHERE is_deleted IS NOT TRUE
  GROUP BY 1, 2
)
SELECT
  gender,
  (age_lo::text || '-' || (age_lo + 4)::text)      AS age_band,
  CASE WHEN cnt < 5 THEN '<5' ELSE cnt::text END   AS n
FROM bucketed
ORDER BY gender, age_lo;


-- ============================================
-- [Q7] 지역 분포 (시/도 근사)
-- 목적: 활동 지역 편중 확인
-- 방법: active_area(자유 텍스트, 예: "서울 강남")의 첫 토큰을 시/도로 근사.
--       NULL/빈값은 '(미입력)'. 5명 미만 시/도는 '기타(소규모 합산)' 로 묶고,
--       그 합계도 5 미만이면 '<5' 로 표시.
-- 예상 결과: 약 3~15행 (region_group, n).
-- 한계: 자유 텍스트라 "서울특별시" / "서울" / "강남" 등 표기가 섞여 있으면 근사 오차 발생.
-- ============================================
WITH r AS (
  SELECT
    COALESCE(NULLIF(split_part(trim(active_area), ' ', 1), ''), '(미입력)') AS region,
    count(*)                                                                AS cnt
  FROM users
  WHERE is_deleted IS NOT TRUE
  GROUP BY 1
),
grp AS (
  SELECT
    CASE WHEN cnt < 5 THEN '기타(소규모 합산)' ELSE region END AS region_group,
    SUM(cnt)                                                    AS cnt
  FROM r
  GROUP BY 1
)
SELECT
  region_group,
  CASE WHEN cnt < 5 THEN '<5' ELSE cnt::text END AS n
FROM grp
ORDER BY (region_group = '기타(소규모 합산)'), cnt DESC;


-- ============================================
-- [Q8] 유저 1인당 조건 충족 후보 수 — 근사 A (나이 선호 미반영)
-- 목적: 매칭풀 희소성의 하한선(가장 느슨한 조건에서도 후보가 몇 명인지)
-- 대상 풀: is_active = TRUE, 삭제 아님
-- 반영 조건: 이성 + 추천인(referrer_name) 상이 + 기존 매칭 이력 없음
-- ⚠️ 생략한 조건 (코드/자유텍스트에만 존재):
--     · age_preference / age_gap (→ Q9 에서 반영)
--     · deal_breakers · desired_conditions 자유 텍스트(흡연·종교·거리·키 등 개별 기피/선호)
--     · AI 적합도 점수 컷(자동매칭은 50점 이상만 생성)
--     · 활동지역 근접성, 진행 중 매칭/정지 후보 제외(→ Q9 에서 반영)
-- ⚠️ 대량 스캔 주의: 활성 유저 자기조인 O(n^2) + 쌍마다 matchings NOT EXISTS.
-- 예상 결과: 1행. pool_users, mean_candidates, p25, median, p75, min/max, zero_candidate_users, zero_pct
-- ============================================
WITH pool AS (
  SELECT id, gender::text AS g, referrer_name
  FROM users
  WHERE is_active = TRUE AND is_deleted IS NOT TRUE
),
cnt AS (
  SELECT p.id, count(q.id) AS c
  FROM pool p
  LEFT JOIN pool q
    ON q.g <> p.g
   AND q.referrer_name <> p.referrer_name
   AND NOT EXISTS (
     SELECT 1 FROM matchings m
     WHERE (m.user_a_id = p.id AND m.user_b_id = q.id)
        OR (m.user_a_id = q.id AND m.user_b_id = p.id)
   )
  GROUP BY p.id
)
SELECT
  count(*)                                                              AS pool_users,
  round(avg(c), 2)                                                      AS mean_candidates,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY c)                       AS p25,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY c)                       AS median,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY c)                       AS p75,
  min(c)                                                                AS min_candidates,
  max(c)                                                                AS max_candidates,
  count(*) FILTER (WHERE c = 0)                                         AS zero_candidate_users,
  round(100.0 * count(*) FILTER (WHERE c = 0) / NULLIF(count(*), 0), 1) AS zero_pct
FROM cnt;


-- ============================================
-- [Q9] 유저 1인당 조건 충족 후보 수 — 근사 B (나이 선호 양방향 반영) + 후보 0명 비율
-- 목적: Q8 + age_preference 양방향 충족 + 진행 중 매칭/정지 후보 제외 → 현실적 후보 수
-- 대상 풀: is_active = TRUE, 삭제 아님, 정지 아님(penalty_until)
-- 나이 판정: 백엔드 _filter_by_ref_age 로직 이식. 한국식 나이 = 2026 - birth_year + 1.
--   age_preference 원소: 'OLDER'(연상) / 'YOUNGER'(연하) / 'SAME'(동갑) / 'ANY'(상관없음)
--   jsonb_exists(x,'KEY') 는 x ? 'KEY' 와 동일(드라이버 호환 위해 함수형 사용).
-- ⚠️ 여전히 생략: deal_breakers·desired_conditions 자유 텍스트 조건, AI 점수 컷.
-- ⚠️ 대량 스캔 주의: Q8 과 동일 구조 + 나이 조건.
-- 예상 결과: 1행. (컬럼은 Q8 과 동일)
-- ============================================
WITH pool AS (
  SELECT
    id,
    gender::text AS g,
    referrer_name,
    (2026 - birth_year + 1) AS k_age,
    CASE WHEN jsonb_typeof(age_preference::jsonb) = 'array'
         THEN age_preference::jsonb END AS ap,
    age_gap_older,
    age_gap_younger
  FROM users
  WHERE is_active = TRUE
    AND is_deleted IS NOT TRUE
    AND (penalty_until IS NULL OR penalty_until <= now())
),
busy AS (
  SELECT user_a_id AS uid FROM matchings
   WHERE user_a_status::text <> 'REJECTED' AND user_b_status::text <> 'REJECTED' AND is_contact_shared = FALSE
  UNION
  SELECT user_b_id FROM matchings
   WHERE user_a_status::text <> 'REJECTED' AND user_b_status::text <> 'REJECTED' AND is_contact_shared = FALSE
),
cnt AS (
  SELECT p.id, count(q.id) AS c
  FROM pool p
  LEFT JOIN pool q
    ON q.g <> p.g
   AND q.referrer_name <> p.referrer_name
   AND q.id NOT IN (SELECT uid FROM busy)
   AND NOT EXISTS (
     SELECT 1 FROM matchings m
     WHERE (m.user_a_id = p.id AND m.user_b_id = q.id)
        OR (m.user_a_id = q.id AND m.user_b_id = p.id)
   )
   AND (  -- p 가 q 의 나이를 허용하는가
     p.ap IS NULL OR jsonb_array_length(p.ap) = 0
     OR (jsonb_exists(p.ap, 'ANY')  AND p.age_gap_older IS NULL AND p.age_gap_younger IS NULL)
     OR (jsonb_exists(p.ap, 'SAME') AND q.k_age = p.k_age)
     OR (jsonb_exists(p.ap, 'OLDER')   AND q.k_age > p.k_age AND (p.age_gap_older   IS NULL OR q.k_age <= p.k_age + p.age_gap_older))
     OR (jsonb_exists(p.ap, 'YOUNGER') AND q.k_age < p.k_age AND (p.age_gap_younger IS NULL OR q.k_age >= p.k_age - p.age_gap_younger))
     OR (jsonb_exists(p.ap, 'ANY')  AND q.k_age BETWEEN p.k_age - COALESCE(p.age_gap_younger, p.k_age)
                                                    AND p.k_age + COALESCE(p.age_gap_older, 9999))
   )
   AND (  -- q 가 p 의 나이를 허용하는가
     q.ap IS NULL OR jsonb_array_length(q.ap) = 0
     OR (jsonb_exists(q.ap, 'ANY')  AND q.age_gap_older IS NULL AND q.age_gap_younger IS NULL)
     OR (jsonb_exists(q.ap, 'SAME') AND p.k_age = q.k_age)
     OR (jsonb_exists(q.ap, 'OLDER')   AND p.k_age > q.k_age AND (q.age_gap_older   IS NULL OR p.k_age <= q.k_age + q.age_gap_older))
     OR (jsonb_exists(q.ap, 'YOUNGER') AND p.k_age < q.k_age AND (q.age_gap_younger IS NULL OR p.k_age >= q.k_age - q.age_gap_younger))
     OR (jsonb_exists(q.ap, 'ANY')  AND p.k_age BETWEEN q.k_age - COALESCE(q.age_gap_younger, q.k_age)
                                                    AND q.k_age + COALESCE(q.age_gap_older, 9999))
   )
  GROUP BY p.id
)
SELECT
  count(*)                                                              AS pool_users,
  round(avg(c), 2)                                                      AS mean_candidates,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY c)                       AS p25,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY c)                       AS median,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY c)                       AS p75,
  min(c)                                                                AS min_candidates,
  max(c)                                                                AS max_candidates,
  count(*) FILTER (WHERE c = 0)                                         AS zero_candidate_users,
  round(100.0 * count(*) FILTER (WHERE c = 0) / NULLIF(count(*), 0), 1) AS zero_pct
FROM cnt;


-- ============================================
-- [Q10] 추천을 한 번도 받지 못한 유저 비율
-- 목적: 풀 노출 대비 실제 추천 도달률
-- 정의:
--   never_targeted     = AI 추천의 '타겟'으로 한 번도 지정되지 않음
--                        (ai_recommend_histories.target_user_id 및 배치 target_ids 기준)
--   never_in_any_reco  = 타겟으로도, 후보로도 AI 평가에 한 번도 등장하지 않음
-- 대상: 삭제 아닌 전체 유저 + is_active 하위집계 별도
-- 예상 결과: 1행.
--   pool_users, never_targeted, never_targeted_pct, never_in_any_reco, never_in_any_reco_pct,
--   never_targeted_active, never_targeted_active_pct
-- ============================================
WITH pool AS (
  SELECT id, is_active FROM users WHERE is_deleted IS NOT TRUE
),
targeted AS (
  SELECT target_user_id AS uid FROM ai_recommend_histories
  UNION
  SELECT x FROM ai_batch_recommend_histories t,
         LATERAL jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(t.target_ids::jsonb) = 'array'
                THEN t.target_ids::jsonb ELSE '[]'::jsonb END
         ) AS x
),
evaluated AS (
  SELECT uid FROM targeted
  UNION
  SELECT k FROM ai_recommend_histories h,
         LATERAL jsonb_object_keys(
           CASE WHEN jsonb_typeof(h.candidate_results::jsonb) = 'object'
                THEN h.candidate_results::jsonb ELSE '{}'::jsonb END
         ) AS k
  UNION
  SELECT x FROM ai_batch_recommend_histories t,
         LATERAL jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(t.candidate_ids::jsonb) = 'array'
                THEN t.candidate_ids::jsonb ELSE '[]'::jsonb END
         ) AS x
)
SELECT
  count(*)                                                                                            AS pool_users,
  count(*) FILTER (WHERE id NOT IN (SELECT uid FROM targeted))                                         AS never_targeted,
  round(100.0 * count(*) FILTER (WHERE id NOT IN (SELECT uid FROM targeted)) / NULLIF(count(*), 0), 1) AS never_targeted_pct,
  count(*) FILTER (WHERE id NOT IN (SELECT uid FROM evaluated))                                        AS never_in_any_reco,
  round(100.0 * count(*) FILTER (WHERE id NOT IN (SELECT uid FROM evaluated)) / NULLIF(count(*), 0), 1) AS never_in_any_reco_pct,
  count(*) FILTER (WHERE is_active AND id NOT IN (SELECT uid FROM targeted))                           AS never_targeted_active,
  round(100.0 * count(*) FILTER (WHERE is_active AND id NOT IN (SELECT uid FROM targeted))
        / NULLIF(count(*) FILTER (WHERE is_active), 0), 1)                                             AS never_targeted_active_pct
FROM pool;


-- ============================================
-- [Q11] AI 적합도 점수 분포 (매칭풀 '질' 보조 지표)
-- 목적: AI가 평가한 궁합 점수가 낮게 몰려 있으면 '풀 내 적합한 상대 부족' 서사 근거
-- 소스:
--   matching_confirmed = matchings.ai_score (실제 생성된 매칭에 붙은 점수)
--   cache_all_eval     = candidate_results JSON 에 남은 '평가된 모든 쌍'의 점수
-- 예상 결과: 1~2행 (src). n<5 인 소스는 참고만.
--   src, n, mean, p25, median, p75, min, max, pct_below_50, pct_below_60
-- ============================================
WITH scores AS (
  SELECT ai_score AS s, 'matching_confirmed' AS src
  FROM matchings
  WHERE ai_score IS NOT NULL
  UNION ALL
  SELECT (v->>'score')::int AS s, 'cache_all_eval' AS src
  FROM ai_recommend_histories h,
       LATERAL jsonb_each(
         CASE WHEN jsonb_typeof(h.candidate_results::jsonb) = 'object'
              THEN h.candidate_results::jsonb ELSE '{}'::jsonb END
       ) AS e(k, v)
  WHERE jsonb_exists(v, 'score')
    AND (v->>'score') ~ '^[0-9]+$'
)
SELECT
  src,
  count(*)                                                      AS n,
  round(avg(s), 1)                                              AS mean,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY s)               AS p25,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY s)               AS median,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY s)               AS p75,
  min(s)                                                        AS min,
  max(s)                                                        AS max,
  round(100.0 * count(*) FILTER (WHERE s < 50) / NULLIF(count(*), 0), 1) AS pct_below_50,
  round(100.0 * count(*) FILTER (WHERE s < 60) / NULLIF(count(*), 0), 1) AS pct_below_60
FROM scores
GROUP BY src
ORDER BY src;


-- ============================================
-- [Q12] 월별 신규 가입 수 (누적 포함)  —  ❌ 측정 불가
-- 사유: users 테이블에 created_at/가입일시 컬럼이 없고, id 는 시간 정보가 없는 랜덤 UUID(uuid4).
-- 대체 지표: Q15(월별 매칭 생성 추이·누적), Q18(월별 배치 추천) 으로 서비스 활성도 추이만 근사.
-- 예상 결과: 1행 (안내 문자열).
-- ============================================
SELECT
  '측정 불가'                                                                       AS status,
  'users 에 created_at/가입일시 컬럼 없음. id 는 시간정보 없는 uuid4.'              AS reason,
  '대체: Q15 월별 매칭 생성 추이(누적), Q18 월별 배치 추천'                          AS alternative;


-- ============================================
-- [Q13] 가입 → 프로필 완성 소요 시간 중앙값  —  ❌ 측정 불가
-- 사유: (1) 가입 일시 컬럼 없음(Q12 참조)  (2) 프로필 등록이 단일 POST /api/users 로 처리되어
--       '완성' 상태나 전이 이벤트/타임스탬프가 존재하지 않음.
-- 예상 결과: 1행 (안내 문자열).
-- ============================================
SELECT
  '측정 불가'                                                                       AS status,
  '가입 일시 없음 + 프로필이 단일 POST 로 생성되어 완성 전이 이벤트가 없음'         AS reason;


-- ============================================
-- [Q14] 가입 후 7일 / 30일 내 재활동 비율  —  ❌ 측정 불가
-- 사유: 로그인/접속/최종활동 타임스탬프가 저장되지 않음.
--       POST /api/users/auth 는 검증만 수행하고 아무 것도 기록하지 않음. 세션/이벤트 로그 테이블 없음.
-- 예상 결과: 1행 (안내 문자열).
-- ============================================
SELECT
  '측정 불가'                                                                       AS status,
  '로그인/접속/최종활동 로그 없음(auth 는 검증만). 세션·이벤트 로그 테이블 없음.'   AS reason;


-- ============================================
-- [Q15] 월별 매칭 생성 추이 (누적 포함)  —  성장 대체 지표
-- 목적: 가입 시계열이 없으므로, 매칭 생성량으로 서비스 활성도 추이 근사
-- 기준: matchings.created_at (UTC)
-- 예상 결과: 서비스 운영 개월 수만큼 (대략 3~12행).
--   month, created, ai_auto, manual, with_ai_score, reached_contact_shared, cumulative_created
-- ============================================
WITH m AS (
  SELECT
    date_trunc('month', created_at)                    AS month,
    count(*)                                           AS created,
    count(*) FILTER (WHERE is_auto_generated)          AS ai_auto,
    count(*) FILTER (WHERE NOT is_auto_generated)      AS manual,
    count(*) FILTER (WHERE ai_score IS NOT NULL)       AS with_ai_score,
    count(*) FILTER (WHERE is_contact_shared)          AS reached_contact_shared
  FROM matchings
  GROUP BY 1
)
SELECT
  to_char(month, 'YYYY-MM')                            AS month,
  created, ai_auto, manual, with_ai_score, reached_contact_shared,
  SUM(created) OVER (ORDER BY month)                   AS cumulative_created
FROM m
ORDER BY month;


-- ============================================
-- [Q16] 총 LLM 호출 수  —  ❌ 정확 측정 불가 / 하한 지표 제공
-- 사유: Gemini 호출 로그 테이블 없음, 토큰 usage 미영속(utils/gemini.py).
-- 대신 아래는 '누적 고유 (타겟,후보) 평가쌍 수' = LLM 평가 처리량의 하한.
--   (캐시 병합으로 과거 평가가 candidate_results 에 계속 누적 보존됨.
--    단, 동일 쌍 재평가·배치의 묶음 호출은 미반영 → 실제보다 낮게 나옴)
-- 예상 결과: 1행.
--   single_history_rows, distinct_targets, cumulative_evaluated_pairs_floor,
--   batch_runs, matchings_with_ai_score
-- ============================================
SELECT
  (SELECT count(*) FROM ai_recommend_histories)                        AS single_history_rows,
  (SELECT count(DISTINCT target_user_id) FROM ai_recommend_histories)  AS distinct_targets,
  (SELECT COALESCE(SUM(k.c), 0)
     FROM ai_recommend_histories h
     CROSS JOIN LATERAL (
       SELECT count(*) AS c FROM jsonb_object_keys(
         CASE WHEN jsonb_typeof(h.candidate_results::jsonb) = 'object'
              THEN h.candidate_results::jsonb ELSE '{}'::jsonb END
       )
     ) k)                                                             AS cumulative_evaluated_pairs_floor,
  (SELECT count(*) FROM ai_batch_recommend_histories)                  AS batch_runs,
  (SELECT count(*) FROM matchings WHERE ai_score IS NOT NULL)          AS matchings_with_ai_score;


-- ============================================
-- [Q17] AiRecommendHistory 캐시 히트율  —  ❌ 측정 불가
-- 사유: 히트/미스는 요청 처리 중 메모리에서만 계산되고 저장되지 않음.
--       AiRecommendHistory 는 타겟별 1행을 병합·덮어쓰기(created_at 갱신)하므로
--       호출 시도 횟수·히트 수를 복원할 수 없음.
-- 예상 결과: 1행 (안내 문자열).
-- ============================================
SELECT
  '측정 불가'                                                                       AS status,
  '캐시 히트/미스 미기록. 이력은 타겟별 1행 병합·덮어쓰기라 시도·히트 횟수 복원 불가.' AS reason;


-- ============================================
-- [Q18] 월별 추천 생성 건수
-- 소스별:
--   batch(정확)                     = ai_batch_recommend_histories 는 append-only → 신뢰 가능
--   single_last_activity(근사·과소)  = ai_recommend_histories.created_at 는
--                                     타겟별 '마지막 추천 활동 시각'만 남김(덮어쓰기) → 과소집계
-- 예상 결과: (운영 개월 수 × 최대 2 소스) 행. src, month, runs
-- ============================================
SELECT src, month, runs
FROM (
  SELECT 'batch(정확)' AS src,
         to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
         count(*) AS runs
  FROM ai_batch_recommend_histories
  GROUP BY 2
  UNION ALL
  SELECT 'single_last_activity(근사·과소집계)' AS src,
         to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
         count(*) AS runs
  FROM ai_recommend_histories
  GROUP BY 2
) t
ORDER BY src, month;


-- ============================================
-- [Q19] 추천 1건당 평균 토큰  —  ❌ 측정 불가
-- 사유: Gemini 응답의 토큰 usage 를 저장하는 컬럼이 어느 테이블에도 없음
--       (matchings / ai_recommend_histories / ai_batch_recommend_histories).
--       utils/gemini.py 도 usage metadata 를 영속화하지 않음.
-- 예상 결과: 1행 (안내 문자열).
-- ============================================
SELECT
  '측정 불가'                                                                       AS status,
  '토큰 usage 저장 컬럼 없음. gemini 유틸도 usage metadata 미영속.'                 AS reason;


-- ============================================
-- [Q20] 수동(연락처) 전달 건수
-- 목적: 운영자가 실제로 연락처를 전달·종결한 건수 (is_contact_shared = 관리자 '전달 완료 처리')
-- 예상 결과: 1행.
--   contact_shared_total, from_manual_matching, from_ai_matching,
--   shared_with_mutual_accept, shared_closed_without_mutual_accept
-- ============================================
SELECT
  count(*) FILTER (WHERE is_contact_shared)                                        AS contact_shared_total,
  count(*) FILTER (WHERE is_contact_shared AND NOT is_auto_generated)              AS from_manual_matching,
  count(*) FILTER (WHERE is_contact_shared AND is_auto_generated)                  AS from_ai_matching,
  count(*) FILTER (WHERE is_contact_shared
                    AND user_a_status::text = 'ACCEPTED'
                    AND user_b_status::text = 'ACCEPTED')                          AS shared_with_mutual_accept,
  count(*) FILTER (WHERE is_contact_shared
                    AND NOT (user_a_status::text = 'ACCEPTED'
                             AND user_b_status::text = 'ACCEPTED'))                AS shared_closed_without_mutual_accept
FROM matchings;


-- ============================================
-- [Q21] 연락처 요청 → 전달까지 소요 시간 중앙값  —  ❌ 측정 불가
-- 사유: is_contact_shared 는 불리언 플래그만 존재하고 전환 시각(shared_at 등)을 남기지 않음.
--       matchings 에 있는 시각은 created_at(쌍 생성)과 expires_at(제안 발송 + 24h)뿐이며
--       '전달 완료 시각' 정보가 없음.
-- 예상 결과: 1행 (안내 문자열).
-- ============================================
SELECT
  '측정 불가'                                                                       AS status,
  'is_contact_shared 전환 시각 미기록. 전달 완료 타임스탬프 없음.'                  AS reason;


-- ############################################################################
-- 보강 쿼리 (1차 결과 검토 후 추가) — Q22 / Q23 / Q24
--   * Q22: 후보 수를 성별로 분리 (Q8/Q9 는 성별 합산이라 여성 쪽 희소성이 가려짐)
--   * Q23: 지역 분포를 서울/경기·인천/기타 3분류로 재집계 (Q7 첫토큰 근사 보정)
--   * Q24: 매칭 응답 결과 조합 분해 (양측수락이 왜 11건뿐인지)
-- ############################################################################


-- ============================================
-- [Q22] 성별별 1인당 조건 충족 후보 수 (느슨 / 나이 반영 동시)
-- 목적: 활성 풀의 성비(여>>남)가 실제 후보 수에 어떻게 나타나는지
-- 대상 풀: is_active = TRUE, 삭제 아님, 정지 아님
-- loose_*  = 이성 + 추천인 상이 + 기존 매칭 없음        (Q8 조건)
-- age_*    = loose + 진행중/정지 후보 제외 + age_preference 양방향  (Q9 조건)
-- ⚠️ 생략: deal_breakers·desired_conditions 자유텍스트, AI 점수 컷.
-- ⚠️ 대량 스캔 주의: 활성 유저 자기조인.
-- 예상 결과: 1~2행 (gender).
--   gender, pool_users, loose_mean, loose_median, age_mean, age_p25, age_median, age_p75,
--   age_min, age_max, zero_age_users
-- ============================================
WITH pool AS (
  SELECT
    id, gender::text AS g, referrer_name,
    (2026 - birth_year + 1) AS k_age,
    CASE WHEN jsonb_typeof(age_preference::jsonb) = 'array'
         THEN age_preference::jsonb END AS ap,
    age_gap_older, age_gap_younger
  FROM users
  WHERE is_active = TRUE
    AND is_deleted IS NOT TRUE
    AND (penalty_until IS NULL OR penalty_until <= now())
),
busy AS (
  SELECT user_a_id AS uid FROM matchings
   WHERE user_a_status::text <> 'REJECTED' AND user_b_status::text <> 'REJECTED' AND is_contact_shared = FALSE
  UNION
  SELECT user_b_id FROM matchings
   WHERE user_a_status::text <> 'REJECTED' AND user_b_status::text <> 'REJECTED' AND is_contact_shared = FALSE
),
cnt AS (
  SELECT
    p.id,
    p.g,
    count(q.id) AS c_loose,
    count(q.id) FILTER (
      WHERE q.id NOT IN (SELECT uid FROM busy)
        AND ( p.ap IS NULL OR jsonb_array_length(p.ap) = 0
              OR (jsonb_exists(p.ap,'ANY')  AND p.age_gap_older IS NULL AND p.age_gap_younger IS NULL)
              OR (jsonb_exists(p.ap,'SAME') AND q.k_age = p.k_age)
              OR (jsonb_exists(p.ap,'OLDER')   AND q.k_age > p.k_age AND (p.age_gap_older   IS NULL OR q.k_age <= p.k_age + p.age_gap_older))
              OR (jsonb_exists(p.ap,'YOUNGER') AND q.k_age < p.k_age AND (p.age_gap_younger IS NULL OR q.k_age >= p.k_age - p.age_gap_younger))
              OR (jsonb_exists(p.ap,'ANY')  AND q.k_age BETWEEN p.k_age - COALESCE(p.age_gap_younger, p.k_age) AND p.k_age + COALESCE(p.age_gap_older, 9999)) )
        AND ( q.ap IS NULL OR jsonb_array_length(q.ap) = 0
              OR (jsonb_exists(q.ap,'ANY')  AND q.age_gap_older IS NULL AND q.age_gap_younger IS NULL)
              OR (jsonb_exists(q.ap,'SAME') AND p.k_age = q.k_age)
              OR (jsonb_exists(q.ap,'OLDER')   AND p.k_age > q.k_age AND (q.age_gap_older   IS NULL OR p.k_age <= q.k_age + q.age_gap_older))
              OR (jsonb_exists(q.ap,'YOUNGER') AND p.k_age < q.k_age AND (q.age_gap_younger IS NULL OR p.k_age >= q.k_age - q.age_gap_younger))
              OR (jsonb_exists(q.ap,'ANY')  AND p.k_age BETWEEN q.k_age - COALESCE(q.age_gap_younger, q.k_age) AND q.k_age + COALESCE(q.age_gap_older, 9999)) )
    ) AS c_age
  FROM pool p
  LEFT JOIN pool q
    ON q.g <> p.g
   AND q.referrer_name <> p.referrer_name
   AND NOT EXISTS (
     SELECT 1 FROM matchings m
     WHERE (m.user_a_id = p.id AND m.user_b_id = q.id)
        OR (m.user_a_id = q.id AND m.user_b_id = p.id)
   )
  GROUP BY p.id, p.g
)
SELECT
  g                                                       AS gender,
  count(*)                                                 AS pool_users,
  round(avg(c_loose), 2)                                   AS loose_mean,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY c_loose)    AS loose_median,
  round(avg(c_age), 2)                                     AS age_mean,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY c_age)      AS age_p25,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY c_age)      AS age_median,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY c_age)      AS age_p75,
  min(c_age)                                               AS age_min,
  max(c_age)                                               AS age_max,
  count(*) FILTER (WHERE c_age = 0)                        AS zero_age_users
FROM cnt
GROUP BY g
ORDER BY g;


-- ============================================
-- [Q23] 지역 분포 — 서울 / 경기·인천 / 기타 3분류 재집계
-- 목적: Q7(첫토큰 근사)에서 '기타(소규모 합산) 41' 로 뭉개진 부분을 수도권 단위로 재확인
-- 방법: active_area 자유텍스트에 대해 서울 자치구·수도권 지명 정규식 매칭.
-- 한계: 여전히 근사(오탈자·동단위 표기·'중구' 등 타지역 동명 지명은 오분류 가능).
-- 예상 결과: 2~4행 (region, n). 5명 미만은 '<5'.
-- ============================================
WITH r AS (
  SELECT
    CASE
      WHEN active_area IS NULL OR btrim(active_area) = '' THEN '(미입력)'
      WHEN active_area ~ ('서울|강남|서초|송파|강동|광진|성동|중랑|동대문|성북|도봉|노원|강북|은평|'
                          || '서대문|마포|양천|강서|구로|금천|영등포|동작|관악|용산|종로|잠실|여의도|'
                          || '홍대|신촌|성수|건대') THEN '서울'
      WHEN active_area ~ ('경기|인천|성남|분당|판교|정자|수원|영통|용인|수지|기흥|동탄|화성|고양|일산|'
                          || '부천|안양|평촌|과천|군포|의왕|안산|시흥|광명|김포|하남|남양주|구리|의정부|'
                          || '파주|송도|부평|계양') THEN '경기·인천'
      ELSE '기타/미상'
    END          AS region,
    count(*)     AS cnt
  FROM users
  WHERE is_deleted IS NOT TRUE
  GROUP BY 1
)
SELECT
  region,
  CASE WHEN cnt < 5 THEN '<5' ELSE cnt::text END AS n
FROM r
ORDER BY cnt DESC;


-- ============================================
-- [Q24] 매칭 응답 결과 조합 분해
-- 목적: 119쌍 중 양측 수락이 11건뿐인 이유 — 거절/무응답이 어디서 발생했는지
-- status_pair: 두 유저 상태를 정렬해 조합으로 표기 (예: 'ACCEPTED + PENDING')
-- 예상 결과: 3~6행. status_pair, pairs, link_expired, closed
--   pairs        = 해당 조합의 매칭 수 (5 미만은 '<5')
--   link_expired = expires_at 가 과거인 수 (무응답 만료 추정)
--   closed       = is_contact_shared=TRUE (관리자가 매칭 종료 처리)
-- ============================================
WITH x AS (
  SELECT
    LEAST(user_a_status::text, user_b_status::text) || ' + ' ||
    GREATEST(user_a_status::text, user_b_status::text)                       AS status_pair,
    count(*)                                                                AS pairs,
    count(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < now())   AS link_expired,
    count(*) FILTER (WHERE is_contact_shared)                               AS closed
  FROM matchings
  GROUP BY 1
)
SELECT
  status_pair,
  CASE WHEN pairs < 5 THEN '<5' ELSE pairs::text END AS pairs,
  link_expired,
  closed
FROM x
ORDER BY x.pairs DESC;
