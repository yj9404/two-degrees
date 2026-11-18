"""
scripts/seed_demo.py
포트폴리오 스크린샷용 데모 시드 데이터 생성 스크립트.

## 무엇을 하는가
1. seed_photos/manifest.json 을 읽어 남 6 / 여 6, 총 12명의 가짜 유저를 생성한다.
   - contact 는 "seed-{manifest_id}@seed.local" 형식으로 통일한다 → 이 접두사/도메인이
     "시드 데이터"임을 나타내는 유일한 마커이며, --purge 롤백도 이 마커로만 대상을 찾는다.
   - 실제 유저는 이 마커를 절대 갖지 않으므로, 이 스크립트는 실제 유저 데이터를
     조회조차 하지 않는다 (건드리거나 삭제할 방법이 없다).
2. seed_photos/*.png 를 frontend/public/seed-photos/ 로 복사하고, photo_urls 는
   "/seed-photos/xxx.png" 상대 경로로 채운다 (Next.js public/ 정적 자산 서빙 활용).
   → R2/S3 자격 증명이 없어도 `npm run dev` 로 바로 사진이 보인다.
3. 남성 3명(m01, m02, m03)을 기준 유저로 실제 Gemini API(utils/gemini.get_ai_recommendations)를
   호출해 여성 후보 풀에서 최고점 상대를 찾고, 그 결과로 매칭 3쌍을 생성한다.
   - main.py의 ai_recommend_matchings 엔드포인트와 동일한 방식으로 AiRecommendHistory에
     캐시를 적재한다 (target_user_id 기준, candidate_id -> {score, reason, name, birth_year}).
   - 3쌍은 아래처럼 서로 다른 진행 상태를 갖는다 (관리자 화면 스크린샷용 퍼널):
       ① m01 쌍: 추천/매칭만 생성됨 (링크 미발급 — expires_at NULL)
       ② m02 쌍: 링크 발급됨, 미열람 (expires_at 24시간 후, 양측 PENDING)
          → /p/{token} 접속 시 "본인 확인" 모달을 캡처할 수 있는 상태
       ③ m03 쌍: 링크 발급 + 열람 완료(양측 ACCEPTED로 응답까지 완료된 상태)

## 알림 발송 차단 관련
백엔드(backend/main.py, utils/*) 와 프론트엔드 전체를 검색한 결과, 카카오톡/이메일/푸시 등
실제 알림을 발송하는 코드 경로가 프로젝트에 아직 존재하지 않는다. 따라서 별도로 "차단"할
대상이 없다. 또한 이 스크립트는 FastAPI 엔드포인트를 거치지 않고 SQLAlchemy 세션으로 직접
INSERT/DELETE 하므로, 추후 엔드포인트 핸들러 안에 알림 발송 코드가 추가되더라도 이 스크립트
실행으로는 트리거되지 않는다.

## 안전장치
- 운영(Cloud Run) 감지: K_SERVICE/K_REVISION 환경변수, GOOGLE_CLOUD_PROJECT(Vertex AI 운영 설정),
  혹은 sqlite가 아닌 DATABASE_URL(=Neon 등 운영 Postgres) 중 하나라도 감지되면 즉시 중단한다.
- 실제 유저는 절대 조회/수정/삭제하지 않는다 (모든 쿼리가 seed contact 마커로 한정됨).
- 이미 시드 데이터가 있으면 재생성하지 않고 재사용한다 (매칭 단계에서 Gemini 호출이
  실패해도 유저 생성부터 다시 반복하지 않도록 하기 위함 — 재실행 시 이어서 진행 가능).

## 사용법
    cd backend
    python scripts/seed_demo.py            # 시드 데이터 생성
    python scripts/seed_demo.py --purge     # 시드 데이터만 롤백 (확인 프롬프트 있음)
    python scripts/seed_demo.py --purge --yes   # 확인 없이 즉시 롤백

자세한 사전 준비는 scripts/README.md 참고.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# backend/ 를 sys.path 에 추가 (scripts/ 하위에서 실행되어도 database/models 등을
# 최상위 backend 모듈처럼 import 할 수 있도록 함)
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

SEED_PHOTOS_DIR = REPO_ROOT / "seed_photos"
FRONTEND_PUBLIC_SEED_DIR = REPO_ROOT / "frontend" / "public" / "seed-photos"

SEED_CONTACT_PREFIX = "seed-"
SEED_CONTACT_DOMAIN = "@seed.local"
SEED_PASSWORD = "SeedDemo1234!"

# main.py / schemas.py 에 하드코딩된 "현재 기준 연도"와 동일하게 맞춘다
# (schemas.py birth_year_reasonable 검증, main.py get_shared_profile 나이 계산 참고)
AGE_REFERENCE_YEAR = 2026

FRONTEND_BASE_URL = "http://localhost:3000"


# ---------------------------------------------------------------------------
# 안전장치 – 운영 환경 감지 시 즉시 중단
# ---------------------------------------------------------------------------

def guard_environment() -> None:
    import os

    if os.environ.get("K_SERVICE") or os.environ.get("K_REVISION"):
        print(
            "[중단] Cloud Run 환경(K_SERVICE/K_REVISION 감지)에서는 이 스크립트를 실행할 수 없습니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    if os.environ.get("GOOGLE_CLOUD_PROJECT"):
        print(
            "[중단] GOOGLE_CLOUD_PROJECT가 설정되어 있습니다. "
            "이는 gemini.py 기준 '운영(Vertex AI)' 설정이므로 중단합니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    from database import DATABASE_URL

    if DATABASE_URL and not DATABASE_URL.startswith("sqlite"):
        host_part = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "(알 수 없음)"
        print(
            f"[중단] DATABASE_URL이 SQLite가 아닙니다 (대상: {host_part}). "
            "이 프로젝트는 SQLite=로컬, PostgreSQL(Neon)=운영 구조이므로 "
            "운영 DB로 판단하여 중단합니다. 로컬 SQLite에서 실행해주세요.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"[확인] 대상 DB: {DATABASE_URL}")


# ---------------------------------------------------------------------------
# 12명 프로필 데이터 (manifest.json의 id 기준으로 병합)
# ---------------------------------------------------------------------------

SEED_PROFILES: dict[str, dict] = {
    "m01": dict(
        name="이준서", job="브랜드 마케터", active_area="성동구 성수동", workplace="성수동",
        education="홍익대 경영학과", height=178, mbti="ENFP", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="SOCIAL_DRINKER",
        exercise="주 2회 클라이밍", hobbies="카페 투어, 필름 카메라, 전시 관람",
        intro="주말엔 늘 새로 생긴 카페를 찾아다니는 편이에요. 일할 때는 꽤 진지한데, "
              "좋아하는 사람 앞에서는 장난기가 많아진다는 얘기를 자주 들어요. "
              "대화가 잘 통하는 사람과는 밤새 이야기해도 안 질리는 편입니다.",
        desired_conditions="대화가 잘 통하고 자기 일을 좋아하는 분이면 좋겠어요",
        deal_breakers="흡연자, 지나치게 계획에 집착하는 분",
        referrer_name="김도윤", instagram_id="junseo.cafe",
        marriage_intent="WILLING", child_plan="OPEN",
        age_preference=["OLDER", "SAME"], age_gap_older=3, age_gap_younger=5,
    ),
    "m02": dict(
        name="김태윤", job="회계사", active_area="종로구", workplace="광화문",
        education="서울시립대 세무회계학과", height=175, mbti="ISTJ", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="SOCIAL_DRINKER",
        exercise="주 3회 러닝", hobbies="독서, 보드게임",
        intro="숫자를 다루는 직업이라 그런지 약속 시간이나 말은 꼭 지키려고 노력해요. "
              "퇴근 후엔 서점에 들러 책 한 권 골라오는 게 낙입니다. "
              "조용히 함께 있어도 편안한 사람을 만나고 싶어요.",
        desired_conditions="차분하고 신뢰할 수 있는 대화가 되는 분",
        deal_breakers="약속을 자주 어기는 분, 과도한 음주",
        referrer_name="박지현", instagram_id=None,
        marriage_intent="WILLING", child_plan="WANT",
        age_preference=["SAME", "YOUNGER"], age_gap_older=2, age_gap_younger=4,
    ),
    "m03": dict(
        name="박준혁", job="건축설계사무소 디자이너", active_area="마포구 연남동", workplace="연남동",
        education="국민대 건축학과", height=180, mbti="INFP", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="NON_DRINKER",
        exercise="주 1회 요가", hobbies="스케치, 필름사진, 산책",
        intro="건물을 그리는 일을 하다 보니 산책하면서 동네 구경하는 걸 참 좋아해요. "
              "연남동 골목 카페들은 거의 다 가봤을걸요. "
              "말이 많은 편은 아니지만, 관심 있는 사람 얘기는 끝까지 들어주는 편이에요. "
              "같이 전시 보러 다닐 사람이면 더 좋겠네요.",
        desired_conditions="자기만의 취향과 여유가 있는 분",
        deal_breakers="타인에게 무례한 언행을 하는 분",
        referrer_name="이수민", instagram_id="junhyuk.sketch",
        marriage_intent="OPEN", child_plan="OPEN",
        age_preference=["SAME"], age_gap_older=2, age_gap_younger=3,
    ),
    "m04": dict(
        name="최민재", job="피트니스 트레이너", active_area="강동구 천호동", workplace="천호동",
        education="용인대 체육학과", height=183, mbti="ESTP", religion="무교",
        smoking_status="SMOKER", drinking_status="SOCIAL_DRINKER",
        exercise="매일 웨이트 트레이닝", hobbies="캠핑, 농구, 헬스",
        intro="몸 쓰는 일을 하다 보니 체력 하나는 자신 있습니다. "
              "운동 좋아하는 분이면 같이 땀 흘리면서 친해질 수 있을 것 같아요. "
              "성격은 털털하고 무던한 편이라 같이 있으면 편하다는 말 많이 들어요.",
        desired_conditions="밝고 에너지 넘치는 분, 운동 함께 즐기면 좋겠어요",
        deal_breakers="흡연 자체를 싫어하는 분, 자기관리에 관심 없는 분",
        referrer_name="최현우", instagram_id=None,
        marriage_intent="NOT_NOW", child_plan="NOT_NOW",
        age_preference=["YOUNGER", "SAME"], age_gap_older=1, age_gap_younger=4,
    ),
    "m05": dict(
        name="정우진", job="초등학교 교사", active_area="은평구", workplace="은평구 소재 초등학교",
        education="서울교육대 초등교육과", height=174, mbti="ISFJ", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="SOCIAL_DRINKER",
        exercise="주 2회 등산", hobbies="빵집 투어, 보드게임, 아이들과 놀기",
        intro="아이들 가르치는 일을 하다 보니 웃을 일이 참 많은 직업이에요. "
              "그래서인지 저도 잘 웃고 정 많다는 얘기를 종종 듣습니다. "
              "소소한 일상도 재밌게 나눌 수 있는 분이면 좋겠어요. "
              "주말엔 동네 산책하면서 맛있는 빵집 찾아다니는 걸 좋아해요.",
        desired_conditions="함께 웃을 수 있는 유쾌하고 다정한 분",
        deal_breakers="아이를 싫어하거나 무시하는 태도",
        referrer_name="장미영", instagram_id="woojin.walk",
        marriage_intent="WILLING", child_plan="WANT",
        age_preference=["SAME", "YOUNGER"], age_gap_older=2, age_gap_younger=5,
    ),
    "m06": dict(
        name="한지훈", job="경영컨설턴트", active_area="강남구", workplace="테헤란로",
        education="연세대 경영학과", height=181, mbti="ENTJ", religion="불교",
        smoking_status="NON_SMOKER", drinking_status="DRINKER",
        exercise="주 4회 헬스, 골프", hobbies="와인, 재즈바, 골프",
        intro="일할 땐 확실하게, 쉴 땐 확실하게 쉬자는 주의입니다. "
              "바쁘게 살아온 만큼 이제는 마음 맞는 사람과 여유를 즐기고 싶어졌어요. "
              "계획적인 편이지만 좋아하는 사람 앞에서는 즉흥적으로 움직이는 것도 잘합니다.",
        desired_conditions="자기 커리어가 확실하고 대화 수준이 맞는 분",
        deal_breakers="우유부단하거나 결정을 계속 미루는 분",
        referrer_name="신동혁", instagram_id="jihoon.biz",
        marriage_intent="WILLING", child_plan="OPEN",
        age_preference=["OLDER", "SAME"], age_gap_older=4, age_gap_younger=6,
    ),
    "f01": dict(
        name="김서연", job="플로리스트", active_area="서대문구", workplace="신촌",
        education="건국대 원예학과", height=162, mbti="ISFP", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="NON_DRINKER",
        exercise="주 2회 필라테스", hobbies="꽃꽂이, 캘리그라피, 카페 투어",
        intro="꽃을 만지는 일을 하다 보니 작은 것에도 감동받고 감사하는 마음이 커진 것 같아요. "
              "손님들 축하하는 꽃다발 만들다 보면 저도 모르게 기분이 좋아지곤 합니다. "
              "다정한 대화를 나눌 수 있는 분과 천천히 알아가고 싶어요.",
        desired_conditions="다정하고 배려심 있는 대화를 나눌 수 있는 분",
        deal_breakers="무뚝뚝하고 연락에 무성의한 분",
        referrer_name="배가은", instagram_id="seoyeon.flower",
        marriage_intent="WILLING", child_plan="WANT",
        age_preference=["OLDER"], age_gap_older=5, age_gap_younger=1,
    ),
    "f02": dict(
        name="이하은", job="항공 승무원", active_area="강서구", workplace="김포공항 인근",
        education="한국항공대 항공서비스학과", height=165, mbti="ESFP", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="SOCIAL_DRINKER",
        exercise="가끔 수영", hobbies="여행, 사진, 맛집 탐방",
        intro="비행이 잦은 직업이라 스케줄은 유동적이지만, 사람 만나는 걸 워낙 좋아해서 "
              "어디서든 잘 지내요. 웃음이 많다는 얘기 정말 많이 듣습니다. "
              "서로 바빠도 연락은 꾸준히 주고받을 수 있는 사이가 좋아요.",
        desired_conditions="긍정적이고 유머 감각 있는 분이면 좋겠어요",
        deal_breakers="흡연자, 연락이 뜸한 분",
        referrer_name="한소연", instagram_id=None,
        marriage_intent="OPEN", child_plan="OPEN",
        age_preference=["OLDER", "SAME"], age_gap_older=6, age_gap_younger=2,
    ),
    "f03": dict(
        name="오유진", job="필라테스 강사", active_area="광진구", workplace="건대입구",
        education="상명대 스포츠건강관리학과", height=163, mbti="ISTP", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="NON_DRINKER",
        exercise="매일 러닝 및 필라테스", hobbies="한강 러닝, 요가, 홈트",
        intro="몸 움직이는 걸 좋아해서 주말엔 한강 러닝을 자주 해요. "
              "무뚝뚝해 보인다는 말을 듣지만 친해지면 장난도 잘 치는 편입니다. "
              "건강하게 자기 관리 하는 사람한테 눈이 가더라고요.",
        desired_conditions="자기관리 잘하고 건강한 라이프스타일을 가진 분",
        deal_breakers="게으르고 무계획적인 분",
        referrer_name="윤태호", instagram_id="yoojin.pilates",
        marriage_intent="OPEN", child_plan="NOT_NOW",
        age_preference=["SAME", "YOUNGER"], age_gap_older=2, age_gap_younger=3,
    ),
    "f04": dict(
        name="윤채원", job="갤러리 큐레이터", active_area="용산구", workplace="이태원",
        education="홍익대 예술학과", height=160, mbti="INFJ", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="SOCIAL_DRINKER",
        exercise="주 1회 요가", hobbies="전시 관람, 영화, 드로잉",
        intro="전시 준비로 정신없이 바쁠 때가 많지만, 그만큼 좋아하는 일이라 만족하며 지내요. "
              "낯을 좀 가리는 편이라 처음엔 조용하다는 얘기를 듣지만 편해지면 이야기가 많아지는 "
              "타입이에요. 전시 보고 나서 감상 나누는 대화를 좋아합니다.",
        desired_conditions="문화생활을 즐기고 대화가 깊은 분",
        deal_breakers="예술이나 문화에 전혀 관심 없는 분",
        referrer_name="정민아", instagram_id="chaewon.gallery",
        marriage_intent="WILLING", child_plan="OPEN",
        age_preference=["OLDER", "SAME"], age_gap_older=4, age_gap_younger=2,
    ),
    "f05": dict(
        name="강나연", job="간호사", active_area="노원구", workplace="상계동 소재 병원",
        education="연세대 간호학과", height=161, mbti="ESFJ", religion="기독교",
        smoking_status="NON_SMOKER", drinking_status="NON_DRINKER",
        exercise="주 2회 홈트", hobbies="드라마 정주행, 베이킹, 산책",
        intro="사람 돌보는 일을 하다 보니 상대방 컨디션부터 살피는 습관이 생겼어요. "
              "교대 근무라 생활 패턴이 불규칙하긴 하지만, 쉬는 날엔 집에서 여유 부리는 걸 "
              "제일 좋아합니다. 따뜻하게 챙겨주는 사람 만나면 저도 그 이상으로 잘해주고 싶어요.",
        desired_conditions="따뜻하고 배려심 많은 분이면 좋겠어요",
        deal_breakers="음주가 잦고 자기관리가 안 되는 분",
        referrer_name="서준호", instagram_id=None,
        marriage_intent="WILLING", child_plan="WANT",
        age_preference=["OLDER", "SAME"], age_gap_older=5, age_gap_younger=1,
    ),
    "f06": dict(
        name="임소율", job="파티시에", active_area="동작구", workplace="홍대 인근 베이커리",
        education="경희대 조리과학과", height=158, mbti="ENFJ", religion="무교",
        smoking_status="NON_SMOKER", drinking_status="SOCIAL_DRINKER",
        exercise="가끔 러닝", hobbies="베이킹, 카페 투어, 반려묘",
        intro="매일 아침 빵 굽는 냄새 맡으면서 하루를 시작해요. "
              "손님들 웃는 얼굴 보는 게 이 일의 제일 큰 보람입니다. "
              "성격은 밝고 씩씩한 편이라 처음 만나도 금방 편해질 거예요. "
              "같이 맛있는 거 먹으러 다닐 사람 찾고 있어요.",
        desired_conditions="밝고 유쾌하며 함께 먹는 즐거움을 아는 분",
        deal_breakers="편식이 심하거나 무뚝뚝한 분",
        referrer_name="조은서", instagram_id="soyul.bakery",
        marriage_intent="OPEN", child_plan="OPEN",
        age_preference=["OLDER", "SAME"], age_gap_older=3, age_gap_younger=2,
    ),
}


def load_manifest() -> list[dict]:
    manifest_path = SEED_PHOTOS_DIR / "manifest.json"
    if not manifest_path.exists():
        print(f"[중단] manifest.json을 찾을 수 없습니다: {manifest_path}", file=sys.stderr)
        sys.exit(1)
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def copy_seed_photos(manifest: list[dict]) -> None:
    FRONTEND_PUBLIC_SEED_DIR.mkdir(parents=True, exist_ok=True)
    for entry in manifest:
        src = SEED_PHOTOS_DIR / entry["filename"]
        if not src.exists():
            print(f"[경고] 사진 파일이 없습니다: {src}", file=sys.stderr)
            continue
        shutil.copyfile(src, FRONTEND_PUBLIC_SEED_DIR / entry["filename"])
    print(f"[완료] 사진 {len(manifest)}장을 frontend/public/seed-photos/ 로 복사했습니다.")


# ---------------------------------------------------------------------------
# 유저 생성
# ---------------------------------------------------------------------------

def build_user_kwargs(manifest_entry: dict) -> dict:
    from models import Gender, SmokingStatus, DrinkingStatus, MarriageIntent, ChildPlan

    mid = manifest_entry["id"]
    profile = SEED_PROFILES[mid]
    apparent_age = int(manifest_entry["apparent_age"])
    birth_year = AGE_REFERENCE_YEAR - apparent_age

    return dict(
        name=profile["name"],
        gender=Gender.MALE if manifest_entry["gender"] == "male" else Gender.FEMALE,
        birth_year=birth_year,
        job=profile["job"],
        contact=f"{SEED_CONTACT_PREFIX}{mid}{SEED_CONTACT_DOMAIN}",
        referrer_name=profile["referrer_name"],
        desired_conditions=profile["desired_conditions"],
        deal_breakers=profile["deal_breakers"],
        is_active=True,
        has_agreed_penalty_policy=True,
        instagram_id=profile["instagram_id"],
        photo_urls=[f"/seed-photos/{manifest_entry['filename']}"],
        height=profile["height"],
        active_area=profile["active_area"],
        education=profile["education"],
        workplace=profile["workplace"],
        mbti=profile["mbti"],
        smoking_status=SmokingStatus[profile["smoking_status"]],
        drinking_status=DrinkingStatus[profile["drinking_status"]],
        religion=profile["religion"],
        exercise=profile["exercise"],
        hobbies=profile["hobbies"],
        intro=profile["intro"],
        age_preference=profile["age_preference"],
        age_gap_older=profile["age_gap_older"],
        age_gap_younger=profile["age_gap_younger"],
        marriage_intent=MarriageIntent[profile["marriage_intent"]],
        child_plan=ChildPlan[profile["child_plan"]],
    )


def get_existing_seed_users(db) -> list:
    from models import User

    return (
        db.query(User)
        .filter(User.contact.like(f"{SEED_CONTACT_PREFIX}%{SEED_CONTACT_DOMAIN}"))
        .all()
    )


def create_seed_users(db, manifest: list[dict]) -> dict:
    """manifest id -> User ORM 객체 매핑을 반환한다."""
    from models import User
    import bcrypt

    existing = get_existing_seed_users(db)
    if existing:
        print(f"[스킵] 이미 시드 유저 {len(existing)}명이 존재합니다. 유저 생성을 건너뜁니다.")
        by_id = {}
        for u in existing:
            mid = u.contact[len(SEED_CONTACT_PREFIX):-len(SEED_CONTACT_DOMAIN)]
            by_id[mid] = u
        return by_id

    password_hash = bcrypt.hashpw(SEED_PASSWORD.encode(), bcrypt.gensalt()).decode()

    by_id = {}
    for entry in manifest:
        kwargs = build_user_kwargs(entry)
        kwargs["password_hash"] = password_hash
        user = User(**kwargs)
        db.add(user)
        by_id[entry["id"]] = user

    db.commit()
    for user in by_id.values():
        db.refresh(user)

    print(f"[완료] 시드 유저 {len(by_id)}명을 생성했습니다. (비밀번호: {SEED_PASSWORD})")
    return by_id


# ---------------------------------------------------------------------------
# AI 추천 + 매칭 3쌍 생성
# ---------------------------------------------------------------------------

def run_ai_matching(db, users_by_id: dict) -> None:
    from models import Matching, AiRecommendHistory, MatchStatus
    from schemas import UserRead, AIRecommendResult
    from utils.gemini import get_ai_recommendations

    existing_seed_ids = {u.id for u in users_by_id.values()}
    existing_matchings = (
        db.query(Matching)
        .filter(
            Matching.user_a_id.in_(existing_seed_ids),
            Matching.user_b_id.in_(existing_seed_ids),
        )
        .all()
    )
    if existing_matchings:
        print(f"[스킵] 이미 시드 매칭 {len(existing_matchings)}쌍이 존재합니다. 매칭 생성을 건너뜁니다.")
        return

    exclude_fields = {"name", "referrer_name", "photo_urls"}
    women_pool = [users_by_id[f"f{i:02d}"] for i in range(1, 7)]
    target_ids = ["m01", "m02", "m03"]

    now = datetime.now(timezone.utc)
    # (created_at 오프셋, expires_at 설정 여부, 응답 상태) 순서로 3쌍의 진행 단계를 다르게 둔다
    stage_plan = [
        {"created_offset": timedelta(days=3), "issue_link": False, "respond": False},
        {"created_offset": timedelta(days=2), "issue_link": True, "respond": False},
        {"created_offset": timedelta(days=1), "issue_link": True, "respond": True},
    ]

    created_pairs = []

    for target_mid, stage in zip(target_ids, stage_plan):
        target_user = users_by_id[target_mid]
        if not women_pool:
            print(f"[경고] {target_mid}에게 매칭할 여성 후보가 남아있지 않습니다.", file=sys.stderr)
            continue

        target_dict = UserRead.model_validate(target_user).model_dump(mode="json", exclude=exclude_fields)
        candidates_dict_list = [
            UserRead.model_validate(c).model_dump(mode="json", exclude=exclude_fields)
            for c in women_pool
        ]

        print(f"[Gemini 호출] target={target_user.name}({target_mid}) candidates={len(women_pool)}명")
        try:
            raw_recs = get_ai_recommendations(target_dict, candidates_dict_list)
        except Exception as e:
            print(f"[중단] Gemini 호출 중 예외 발생 ({target_mid}): {e}", file=sys.stderr)
            db.rollback()
            sys.exit(1)

        cand_by_id = {c.id: c for c in women_pool}
        parsed_results: list[AIRecommendResult] = []
        for rec in raw_recs:
            try:
                parsed_results.append(AIRecommendResult(**rec))
            except Exception:
                continue

        if not parsed_results:
            print(
                f"[중단] {target_mid}에 대한 Gemini 추천 결과가 비어 있습니다. "
                "GEMINI_API_KEY 설정을 확인해주세요.",
                file=sys.stderr,
            )
            db.rollback()
            sys.exit(1)

        parsed_results.sort(key=lambda r: r.score, reverse=True)
        winner = parsed_results[0]
        winner_user = cand_by_id[winner.candidate_id]

        # 프로덕션과 동일한 형식으로 AiRecommendHistory 캐시 적재
        candidate_results = {
            r.candidate_id: {
                "score": r.score,
                "reason": r.reason,
                "name": cand_by_id[r.candidate_id].name,
                "birth_year": cand_by_id[r.candidate_id].birth_year,
            }
            for r in parsed_results
        }
        db.add(AiRecommendHistory(target_user_id=target_user.id, candidate_results=candidate_results))

        sorted_ids = sorted([target_user.id, winner_user.id])
        matching = Matching(
            user_a_id=sorted_ids[0],
            user_b_id=sorted_ids[1],
            ai_score=winner.score,
            ai_reason=winner.reason,
            is_auto_generated=False,
            created_at=now - stage["created_offset"],
        )
        if stage["issue_link"]:
            matching.expires_at = now + timedelta(hours=24, minutes=1)
        if stage["respond"]:
            matching.user_a_status = MatchStatus.ACCEPTED
            matching.user_b_status = MatchStatus.ACCEPTED

        db.add(matching)
        db.commit()
        db.refresh(matching)

        women_pool = [w for w in women_pool if w.id != winner_user.id]
        created_pairs.append((target_user, winner_user, matching, stage))
        print(
            f"  -> 매칭 생성: {target_user.name} <-> {winner_user.name} "
            f"(score={winner.score}, issue_link={stage['issue_link']}, respond={stage['respond']})"
        )

    print("\n[요약] 생성된 매칭 3쌍의 상태:")
    for target_user, winner_user, matching, stage in created_pairs:
        if not stage["issue_link"]:
            state = "추천/매칭 생성됨 (링크 미발급)"
        elif not stage["respond"]:
            state = "링크 발급, 미열람 (본인 확인 모달 캡처용)"
        else:
            state = "링크 발급 + 응답 완료 (양측 수락)"
        print(f"  - {target_user.name} <-> {winner_user.name}: {state}")
        if stage["issue_link"] and not stage["respond"]:
            print(f"      캡처용 링크: {FRONTEND_BASE_URL}/p/{matching.user_a_token}")


# ---------------------------------------------------------------------------
# 롤백 (--purge)
# ---------------------------------------------------------------------------

def purge_seed_data(db, skip_confirm: bool) -> None:
    from models import User, Matching, AiRecommendHistory

    seed_users = get_existing_seed_users(db)
    if not seed_users:
        print("[정보] 삭제할 시드 데이터가 없습니다.")
        return

    seed_ids = {u.id for u in seed_users}
    matchings = (
        db.query(Matching)
        .filter((Matching.user_a_id.in_(seed_ids)) | (Matching.user_b_id.in_(seed_ids)))
        .all()
    )
    histories = (
        db.query(AiRecommendHistory)
        .filter(AiRecommendHistory.target_user_id.in_(seed_ids))
        .all()
    )

    print(
        f"[확인] 시드 유저 {len(seed_users)}명, 매칭 {len(matchings)}쌍, "
        f"AI 추천 이력 {len(histories)}건을 삭제합니다."
    )
    if not skip_confirm:
        answer = input("정말 삭제하시겠습니까? (y/N): ").strip().lower()
        if answer != "y":
            print("[취소] 롤백을 취소했습니다.")
            return

    for h in histories:
        db.delete(h)
    for m in matchings:
        db.delete(m)
    for u in seed_users:
        db.delete(u)
    db.commit()

    if FRONTEND_PUBLIC_SEED_DIR.exists():
        shutil.rmtree(FRONTEND_PUBLIC_SEED_DIR)

    print("[완료] 시드 데이터를 모두 삭제했습니다.")


# ---------------------------------------------------------------------------
# 엔트리 포인트
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="TwoDegrees 포트폴리오 스크린샷용 데모 시드 데이터")
    parser.add_argument("--purge", action="store_true", help="시드 데이터만 롤백하고 종료")
    parser.add_argument("--yes", action="store_true", help="--purge 확인 프롬프트 생략")
    args = parser.parse_args()

    guard_environment()

    from database import Base, engine, SessionLocal
    import models  # noqa: F401  (Base.metadata에 테이블 등록 목적)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.purge:
            purge_seed_data(db, skip_confirm=args.yes)
            return

        manifest = load_manifest()
        copy_seed_photos(manifest)
        users_by_id = create_seed_users(db, manifest)
        run_ai_matching(db, users_by_id)
        print(f"\n[완료] 관리자 로그인 후 http://localhost:3000/admin 에서 확인하세요.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
