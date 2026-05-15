"""
main.py
TwoDegrees FastAPI 애플리케이션 엔트리포인트
"""

from typing import Optional
import logging
import os
import secrets
import hashlib
import jwt
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, or_

from database import Base, engine, get_db
from models import Gender, User, Matching, MatchStatus, Notice, AiRecommendHistory, AiBatchRecommendHistory
from schemas import (
    AdminAuthRequest,
    AIBatchRecommendHistoryRead,
    AIBatchRecommendRequest,
    AIBatchRecommendResultItem,
    AIRecommendRequest,
    AIRecommendHistoryRead,
    AIRecommendResult,
    AuthRequest,
    AuthResponse,
    DailyMatchingStatsResponse,
    MatchRespondRequest,
    MatchingCreate,
    MatchingResponse,
    MatchingUpdate,
    NoticeCreate,
    NoticeRead,
    NoticeUpdate,
    PenaltyUpdate,
    PresignedUrlResponse,
    SharedProfileRead,
    UserCreate,
    UserReadAdmin,
    UserStatsResponse,
    UserUpdate,
)

logger = logging.getLogger(__name__)

_scheduler_secret = os.environ.get("SCHEDULER_SECRET", "")

# ---------------------------------------------------------------------------
# 앱 초기화 및 테이블 자동 생성
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TwoDegrees API",
    description="소개팅 풀 등록 및 관리 API",
    version="1.0.4",
)

# 운영 환경에서는 ALLOWED_ORIGINS 환경변수를 통해 허용할 출처를 명시적으로 설정합니다.
allowed_origins_str = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000, http://localhost:3001, http://localhost:8000, http://127.0.0.1:3000, http://127.0.0.1:8000"
)
allowed_origins = [origin.strip().rstrip('/') for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB 테이블이 없으면 자동 생성
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# 페널티 스케줄러 (APScheduler) – 매월 1일 0시 penalty_points 초기화
# ---------------------------------------------------------------------------

def _run_generate_daily_matches() -> dict:
    """
    활성 남녀 유저 풀에서 AI 적합도 50점 이상인 커플 최대 2쌍을 PENDING으로 생성합니다.
    스케줄러와 수동 API 엔드포인트에서 공통으로 호출됩니다.
    반환: {"created": int, "attempts": int}
    """
    import random
    from database import SessionLocal
    from utils.gemini import get_ai_recommendations
    from schemas import UserRead

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        active_users = db.query(User).filter(
            User.is_active == True,
            or_(User.penalty_until.is_(None), User.penalty_until <= now),
        ).all()

        males = [u for u in active_users if u.gender == Gender.MALE]
        females = [u for u in active_users if u.gender == Gender.FEMALE]
        logger.info(f"[DailyScheduler] 활성 유저 — 남: {len(males)}명, 여: {len(females)}명")

        busy_matches = db.query(Matching).filter(
            Matching.user_a_status != MatchStatus.REJECTED,
            Matching.user_b_status != MatchStatus.REJECTED,
            Matching.is_contact_shared == False,
        ).all()
        busy_ids = {m.user_a_id for m in busy_matches} | {m.user_b_id for m in busy_matches}
        logger.info(f"[DailyScheduler] 진행 중 매칭으로 제외된 유저: {len(busy_ids)}명")

        all_matches = db.query(Matching).all()
        matched_pairs: set[tuple[str, str]] = {
            (min(m.user_a_id, m.user_b_id), max(m.user_a_id, m.user_b_id))
            for m in all_matches
        }
        logger.info(f"[DailyScheduler] 전체 매칭 이력: {len(matched_pairs)}쌍")

        avail_males = [u for u in males if u.id not in busy_ids]
        avail_females = [u for u in females if u.id not in busy_ids]
        logger.info(f"[DailyScheduler] 매칭 가능 유저 — 남: {len(avail_males)}명, 여: {len(avail_females)}명")

        exclude_fields = {"name", "referrer_name", "photo_urls"}
        successful_matches = 0
        attempts = 0
        used_this_run: set[str] = set()

        while successful_matches < 2 and attempts < 10:
            attempts += 1

            cur_males = [u for u in avail_males if u.id not in used_this_run]
            cur_females = [u for u in avail_females if u.id not in used_this_run]
            if not cur_males or not cur_females:
                logger.info(f"[DailyScheduler] 시도 {attempts}: 가용 유저 소진 — 남 잔여 {len(cur_males)}명, 여 잔여 {len(cur_females)}명")
                break

            male = random.choice(cur_males)
            female = random.choice(cur_females)
            logger.info(f"[DailyScheduler] 시도 {attempts}: 후보 선택 — 남({male.name}), 여({female.name})")

            pair_key = (min(male.id, female.id), max(male.id, female.id))
            if pair_key in matched_pairs:
                logger.info(f"[DailyScheduler] 시도 {attempts}: SKIP — 기존 매칭 이력 존재")
                continue

            male_dict = UserRead.model_validate(male).model_dump(mode="json", exclude=exclude_fields)
            female_dict = UserRead.model_validate(female).model_dump(mode="json", exclude=exclude_fields)

            logger.info(f"[DailyScheduler] 시도 {attempts}: Gemini API 호출 중...")
            try:
                results = get_ai_recommendations(male_dict, [female_dict])
            except Exception as e:
                logger.error(f"[DailyScheduler] 시도 {attempts}: Gemini API 오류 — {e}")
                continue

            if not results:
                logger.info(f"[DailyScheduler] 시도 {attempts}: SKIP — Gemini 결과 없음")
                continue

            score = results[0].get("score", 0)
            reason = results[0].get("reason", "")
            logger.info(f"[DailyScheduler] 시도 {attempts}: AI 점수 {score}점")

            if score < 50:
                logger.info(f"[DailyScheduler] 시도 {attempts}: SKIP — 점수 미달 ({score}점 < 50점)")
                continue

            sorted_ids = sorted([male.id, female.id])
            existing = db.query(Matching).filter(
                Matching.user_a_id == sorted_ids[0],
                Matching.user_b_id == sorted_ids[1],
            ).first()
            if existing:
                logger.info(f"[DailyScheduler] 시도 {attempts}: SKIP — DB 중복 매칭 존재")
                continue

            new_matching = Matching(
                user_a_id=sorted_ids[0],
                user_b_id=sorted_ids[1],
                ai_score=score,
                ai_reason=reason,
                is_auto_generated=True,
            )
            db.add(new_matching)
            db.commit()
            db.refresh(new_matching)

            matched_pairs.add(pair_key)
            used_this_run.add(male.id)
            used_this_run.add(female.id)
            successful_matches += 1
            logger.info(
                f"[DailyScheduler] Auto match created: {male.name} + {female.name}, score={score}"
            )

        logger.info(
            f"[DailyScheduler] Done: {successful_matches} match(es) created in {attempts} attempt(s)."
        )
        return {"created": successful_matches, "attempts": attempts}
    except Exception as exc:
        db.rollback()
        logger.error(f"[DailyScheduler] Unexpected error: {exc}", exc_info=True)
        raise
    finally:
        db.close()


try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    def _reset_monthly_penalty_points():
        """
        매월 1일 0시에 실행.
        - 정지 중이 아닌 유저: penalty_points를 즉시 0으로 초기화.
        - 정지 중인 유저: 이미 정지가 끝난 경우(penalty_until <= now)에만 0으로 초기화.
          아직 정지 중이면 이번 달은 초기화하지 않고, 정지 해제 후 다음 판단 시점에 처리.
        """
        from database import SessionLocal
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)

            # Case 1: 정지 중이 아닌 유저 (penalty_until IS NULL OR penalty_until <= now)
            db.query(User).filter(
                or_(User.penalty_until.is_(None), User.penalty_until <= now)
            ).update({"penalty_points": 0.0}, synchronize_session=False)

            # Case 2: 아직 정지 중인 유저는 건드리지 않음 (penalty_until > now)
            # -> penalty_until이 지나면 contact-shared 엔드포인트에서 penalty_points가
            #    이미 초기화되어야 하지 않으므로, 별도 주기 job에서 처리.
            # 여기서는 월 초기화 시점에 '이미 해제된' 정지 유저만 처리한다.

            db.commit()
            logger.info("[Scheduler] Monthly penalty_points reset completed.")
        except Exception as exc:
            db.rollback()
            logger.error(f"[Scheduler] Monthly penalty reset error: {exc}")
        finally:
            db.close()

    def _generate_daily_matches():
        try:
            _run_generate_daily_matches()
        except Exception:
            pass  # 에러는 _run_generate_daily_matches 내부에서 이미 로깅됨

    _scheduler = BackgroundScheduler()
    # 매월 1일 0시 (서버 로컬 시간 기준)
    _scheduler.add_job(_reset_monthly_penalty_points, CronTrigger(day=1, hour=0, minute=0))
    # 매일 KST 09:00 자동 매칭 생성
    _scheduler.add_job(_generate_daily_matches, CronTrigger(hour=9, minute=0, timezone="Asia/Seoul"))
    _scheduler.start()
    logger.info("[Scheduler] Penalty reset scheduler started.")
except ImportError:
    logger.warning("[Scheduler] apscheduler not installed. Monthly penalty reset will not run.")

# ---------------------------------------------------------------------------
# 비밀번호 해싱 유틸 (bcrypt 직접 사용 – passlib 1.7.4 / bcrypt 4.x+ 호환 문제 우회)
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# 관리자 인증 의존성 (JWT)
# ---------------------------------------------------------------------------

# .env에서 비밀번호나 시크릿을 가져옵니다.
_admin_pass = os.environ.get("ADMIN_PASSWORD", "temp_static_secret_for_jwt")
_raw_secret = os.environ.get("JWT_SECRET", _admin_pass)

# HS256 알고리즘은 최소 32바이트(256비트)의 키를 권장합니다.
# 입력된 시크릿이 짧을 경우 취약한 패딩 대신 SHA-256 해시를 사용하여 32바이트의 고정 키를 생성합니다.
JWT_SECRET = hashlib.sha256(_raw_secret.encode("utf-8")).hexdigest()
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60 * 24  # 1일

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/login", auto_error=False)


def verify_admin(token: str = Depends(oauth2_scheme)):
    """
    JWT 토큰을 검증하여 관리자 권한을 인증합니다.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="관리자 권한이 없습니다. (토큰 누락)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") != "admin":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="권한이 없습니다.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return "admin"
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# POST /api/users – 유저 프로필 등록
# ---------------------------------------------------------------------------

@app.post(
    "/api/users",
    response_model=UserReadAdmin,
    status_code=status.HTTP_201_CREATED,
    summary="소개팅 풀 등록",
    tags=["users"],
)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    """
    새 유저를 소개팅 풀에 등록합니다.
    - 입력받은 평문 비밀번호를 bcrypt로 해싱하여 저장합니다.
    - contact 중복 등록을 방지합니다.
    """
    # 연락처 중복 검사 (하이픈 무시)
    normalized_contact = payload.contact.replace("-", "")
    existing = db.query(User).filter(
        func.replace(User.contact, "-", "") == normalized_contact
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 연락처입니다.",
        )

    # 평문 비밀번호 → bcrypt 해시 변환 후 저장
    data = payload.model_dump(exclude={"password"})
    data["password_hash"] = hash_password(payload.password)
    data["is_active"] = True
    data["has_agreed_penalty_policy"] = True

    new_user = User(**data)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    new_user.match_count = 0
    return new_user


# ---------------------------------------------------------------------------
# POST /api/users/auth – 본인 인증 (로그인)
# ⚠️  반드시 /api/users/{user_id} 보다 위에 선언해야 합니다.
# ---------------------------------------------------------------------------

@app.post(
    "/api/users/auth",
    response_model=AuthResponse,
    summary="본인 인증 (로그인)",
    tags=["users"],
)
def authenticate_user(payload: AuthRequest, db: Session = Depends(get_db)):
    """
    contact와 password를 검증합니다.
    - 실패 시 401을 반환합니다.
    - 연락처 하이픈('-') 입력 여부에 상관없이 검증합니다.
    """
    normalized_contact = payload.contact.replace("-", "")
    user = db.query(User).filter(
        func.replace(User.contact, "-", "") == normalized_contact
    ).first()

    # 유저 미존재 또는 비밀번호 불일치 — 동일 에러 메시지로 정보 누출 방지
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="연락처 또는 비밀번호가 올바르지 않습니다.",
        )

    return AuthResponse(user_id=user.id, name=user.name)


# ---------------------------------------------------------------------------
# GET /api/users/stats – 활성화된 유저 남/녀 비율 통계
# ⚠️ 반드시 /api/users/{user_id} 보다 위에 선언해야 합니다.
# ---------------------------------------------------------------------------

@app.get(
    "/api/users/stats",
    response_model=UserStatsResponse,
    summary="활성화된 유저 남/녀 통계",
    tags=["users"],
)
def get_user_stats(db: Session = Depends(get_db)):
    """
    현재 매칭풀에 활성화(is_active=True)된 유저들의 남녀 활동 비율 및 전체 통계를 반환합니다.
    """
    total_users = db.query(User).count()
    total_matchings = db.query(Matching).count()
    
    # Aggregate gender counts at the database level
    stats = (
        db.query(User.gender, func.count(User.id))
        .filter(User.is_active == True)
        .group_by(User.gender)
        .all()
    )

    counts = {gender: count for gender, count in stats}
    male_count = counts.get(Gender.MALE, 0)
    female_count = counts.get(Gender.FEMALE, 0)
    total_active = male_count + female_count

    male_ratio = round((male_count / total_active * 100)) if total_active > 0 else 0
    female_ratio = round((female_count / total_active * 100)) if total_active > 0 else 0

    return {
        "total_active": total_active,
        "total_users": total_users,
        "total_matchings": total_matchings,
        "male_active": male_count,
        "female_active": female_count,
        "male_ratio": float(male_ratio),
        "female_ratio": float(female_ratio),
    }


# ---------------------------------------------------------------------------
# GET /api/users/{user_id} – 단일 유저 조회 (프로필 수정 pre-fill용)
# ---------------------------------------------------------------------------

@app.get(
    "/api/users/{user_id}",
    response_model=UserReadAdmin,
    summary="단일 유저 조회",
    tags=["users"],
)
def get_user(user_id: str, db: Session = Depends(get_db)):
    """
    user_id(UUID)로 유저를 조회합니다.
    프로필 수정 페이지의 데이터 pre-fill에 사용됩니다.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 유저를 찾을 수 없습니다.",
        )
    from sqlalchemy import or_
    user.match_count = db.query(Matching).filter(or_(Matching.user_a_id == user_id, Matching.user_b_id == user_id)).count()
    return user


# ---------------------------------------------------------------------------
# PUT /api/users/{user_id} – 유저 프로필 수정
# ---------------------------------------------------------------------------

@app.put(
    "/api/users/{user_id}",
    response_model=UserReadAdmin,
    summary="유저 프로필 수정",
    tags=["users"],
)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
):
    """
    유저 정보를 부분 수정합니다.
    - is_active 토글로 매칭 풀 노출 여부를 제어합니다.
    - 전달된 필드만 업데이트합니다 (exclude_unset=True).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 유저를 찾을 수 없습니다.",
        )

    # 실제로 전달된 필드만 업데이트 (None을 의도적으로 보냈는지, 아예 안 보냈는지 구분)
    update_data = payload.model_dump(exclude_unset=True)

    # photo_urls 장 수 제한 (최대 10장)
    if "photo_urls" in update_data and update_data["photo_urls"] is not None:
        if len(update_data["photo_urls"]) > 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="사진은 최대 10장까지 업로드할 수 있습니다.",
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    # 프로필 수정 시 AI 매칭 이력 정리
    # 1. 기준(target)이었던 이력 전체 삭제
    db.query(AiRecommendHistory).filter(
        AiRecommendHistory.target_user_id == user_id
    ).delete(synchronize_session=False)

    # 2. 후보(candidate)였던 이력에서 해당 유저만 제거
    from sqlalchemy.orm.attributes import flag_modified
    candidate_histories = db.query(AiRecommendHistory).all()
    for hist in candidate_histories:
        results = hist.candidate_results or {}
        if user_id in results:
            updated = {k: v for k, v in results.items() if k != user_id}
            if not updated:
                db.delete(hist)
            else:
                hist.candidate_results = updated
                flag_modified(hist, "candidate_results")

    db.commit()

    from sqlalchemy import or_
    user.match_count = db.query(Matching).filter(or_(Matching.user_a_id == user_id, Matching.user_b_id == user_id)).count()
    return user


# ---------------------------------------------------------------------------
# GET /api/users – 전체 유저 목록 조회 (관리자용)
# ---------------------------------------------------------------------------

def _filter_by_ref_age(users: list["User"], ref_age: int) -> list["User"]:
    """
    선호 연령대 교차 검증 — SQL 연산 대신 Python 후처리로 안전하게 수행
    유저의 한국 나이 = 2026 - birth_year + 1
    유저가 허용하는 파트너 나이 범위:
      하한 = 유저 나이 - age_gap_older  (연상 파트너 허용 최대 나이차)
      상한 = 유저 나이 + age_gap_younger (연하 파트너 허용 최대 나이차)
    """
    _CURRENT_YEAR = 2026

    def _accepts_ref_age(u: "User") -> bool:
        age_pref: list = u.age_preference or []
        user_age = _CURRENT_YEAR - u.birth_year + 1

        # 선호 데이터 없음 → 상관없음
        if not age_pref:
            return True
        # ANY이고 gap도 없음 → 상관없음
        if "ANY" in age_pref and u.age_gap_older is None and u.age_gap_younger is None:
            return True

        # 동갑 허용
        if "SAME" in age_pref and ref_age == user_age:
            return True

        # 연상 허용: ref_age가 user보다 나이 많아야 하고, gap_older 이내
        if "OLDER" in age_pref and ref_age > user_age:
            if u.age_gap_older is None or ref_age <= user_age + u.age_gap_older:
                return True

        # 연하 허용: ref_age가 user보다 나이 적어야 하고, gap_younger 이내
        if "YOUNGER" in age_pref and ref_age < user_age:
            if u.age_gap_younger is None or ref_age >= user_age - u.age_gap_younger:
                return True

        # ANY이지만 gap 데이터가 있는 경우 → gap 범위로 체크
        if "ANY" in age_pref:
            lower = (user_age - u.age_gap_younger) if u.age_gap_younger is not None else 0
            upper = (user_age + u.age_gap_older) if u.age_gap_older is not None else 9999
            if lower <= ref_age <= upper:
                return True

        return False

    return [u for u in users if _accepts_ref_age(u)]


def _apply_user_filters(
    query,
    gender: Optional[Gender],
    birth_year_min: Optional[int],
    birth_year_max: Optional[int],
    active_area: Optional[str],
    is_active: Optional[bool],
    smoking_status: Optional[str],
    mbti_includes: Optional[str],
    religion: Optional[str],
    drinking_status: Optional[str],
    min_height: Optional[int],
    max_height: Optional[int],
    child_plan: Optional[str],
    marriage_intent: Optional[str],
):

    # ── 기존 필터 ────────────────────────────────────────────────────────────
    if gender is not None:
        query = query.filter(User.gender == gender)
    if birth_year_min is not None:
        query = query.filter(User.birth_year >= birth_year_min)
    if birth_year_max is not None:
        query = query.filter(User.birth_year <= birth_year_max)
    if active_area is not None:
        query = query.filter(User.active_area.ilike(f"%{active_area}%"))
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if smoking_status is not None:
        try:
            query = query.filter(User.smoking_status == SmokingStatus(smoking_status))
        except ValueError:
            pass

    # ── 고급 필터 ────────────────────────────────────────────────────────────

    # MBTI: 쉼표로 구분된 글자를 모두 포함해야 함 (예: "E,N" → ENFP, ENTJ 등)
    if mbti_includes:
        letters = [l.strip().upper() for l in mbti_includes.split(",") if l.strip()]
        for letter in letters:
            query = query.filter(User.mbti.ilike(f"%{letter}%"))

    # 종교: "그외"는 알려진 4개 종교를 제외한 나머지
    if religion:
        _KNOWN_RELIGIONS = ["무교", "기독교", "불교", "천주교"]
        if religion == "그외":
            query = query.filter(User.religion.isnot(None))
            query = query.filter(User.religion != "")
            query = query.filter(User.religion.notin_(_KNOWN_RELIGIONS))
        else:
            query = query.filter(User.religion == religion)

    # 음주 여부
    if drinking_status:
        try:
            query = query.filter(User.drinking_status == DrinkingStatus(drinking_status))
        except ValueError:
            pass

    # 키 범위
    if min_height is not None:
        query = query.filter(User.height >= min_height)
    if max_height is not None:
        query = query.filter(User.height <= max_height)

    # 자녀 계획
    if child_plan:
        try:
            query = query.filter(User.child_plan == ChildPlan(child_plan))
        except ValueError:
            pass

    # 결혼 의향
    if marriage_intent:
        try:
            query = query.filter(User.marriage_intent == MarriageIntent(marriage_intent))
        except ValueError:
            pass

    return query

@app.get(
    "/api/users",
    response_model=list[UserReadAdmin],
    summary="유저 목록 조회 (관리자)",
    tags=["users"],
)
def list_users(
    gender: Optional[Gender] = Query(None, description="성별 필터 (MALE | FEMALE)"),
    birth_year_min: Optional[int] = Query(None, ge=1940, le=2010, description="출생연도 하한"),
    birth_year_max: Optional[int] = Query(None, ge=1940, le=2010, description="출생연도 상한"),
    active_area: Optional[str] = Query(None, description="주 활동 지역 (부분 일치)"),
    is_active: Optional[bool] = Query(None, description="매칭 풀 활성 여부 필터"),
    smoking_status: Optional[str] = Query(None, description="흡연 여부 필터 (SMOKER | NON_SMOKER)"),
    # ── 고급 필터 ──────────────────────────────────────────────────────────────
    # models.py 컬럼 타입 가정:
    #   mbti          → String(4)   예: "ENFP"
    #   religion      → String(50)  예: "기독교"
    #   drinking_status → Enum(DrinkingStatus)
    #   height        → Integer     단위: cm
    #   child_plan    → Enum(ChildPlan)
    #   marriage_intent → Enum(MarriageIntent)
    #   birth_year    → Integer     예: 1997
    #   age_gap_older → Integer     연상 허용 최대 나이차
    #   age_gap_younger → Integer   연하 허용 최대 나이차
    mbti_includes: Optional[str] = Query(None, description="MBTI 포함 문자 (쉼표 구분, 예: E,N,F) — 모두 포함하는 유저 검색"),
    religion: Optional[str] = Query(None, description="종교 (무교|기독교|불교|천주교|그외)"),
    drinking_status: Optional[str] = Query(None, description="음주 여부 (NON_DRINKER|SOCIAL_DRINKER|DRINKER)"),
    min_height: Optional[int] = Query(None, ge=100, le=250, description="최소 키 (cm)"),
    max_height: Optional[int] = Query(None, ge=100, le=250, description="최대 키 (cm)"),
    child_plan: Optional[str] = Query(None, description="자녀 계획 (WANT|OPEN|NOT_NOW|DINK)"),
    marriage_intent: Optional[str] = Query(None, description="결혼 의향 (WILLING|OPEN|NOT_NOW|NON_MARRIAGE)"),
    ref_age: Optional[int] = Query(None, ge=18, le=70, description="교차 검증 기준 나이 — 이 나이를 희망 파트너 범위에 포함하는 유저 검색"),
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    등록된 유저 목록을 반환합니다. 쿼리 파라미터로 복합 필터링을 지원합니다.

    - **gender**: MALE 또는 FEMALE
    - **birth_year_min / birth_year_max**: 출생연도 범위 (예: 1990~2000)
    - **active_area**: 부분 문자열 일치 검색 (예: \"강남\" → \"서울 강남구\" 매칭)
    - **is_active**: true이면 매칭 풀에 활성화된 유저만 조회
    - **smoking_status**: SMOKER 또는 NON_SMOKER
    - **mbti_includes**: 쉼표로 구분된 MBTI 글자 — 해당 글자를 모두 포함하는 MBTI 유저 검색
    - **religion**: 종교 필터. \"그외\"는 무교/기독교/불교/천주교를 제외한 나머지
    - **drinking_status**: NON_DRINKER | SOCIAL_DRINKER | DRINKER
    - **min_height / max_height**: 키 범위 (cm)
    - **child_plan**: WANT | OPEN | NOT_NOW | DINK
    - **marriage_intent**: WILLING | OPEN | NOT_NOW | NON_MARRIAGE
    - **ref_age**: 교차 검증 기준 나이. 이 나이가 유저의 희망 파트너 나이 범위에 포함되는지 확인
    """

    if birth_year_min and birth_year_max and birth_year_min > birth_year_max:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="birth_year_min이 birth_year_max보다 클 수 없습니다.",
        )

    query = db.query(User)

    query = _apply_user_filters(
        query,
        gender=gender,
        birth_year_min=birth_year_min,
        birth_year_max=birth_year_max,
        active_area=active_area,
        is_active=is_active,
        smoking_status=smoking_status,
        mbti_includes=mbti_includes,
        religion=religion,
        drinking_status=drinking_status,
        min_height=min_height,
        max_height=max_height,
        child_plan=child_plan,
        marriage_intent=marriage_intent,
    )

    users = query.all()

    if ref_age is not None:
        users = _filter_by_ref_age(users, ref_age)

    # 데이터베이스 레벨에서 카운트 집계
    from sqlalchemy import func
    user_ids = [u.id for u in users]
    counts = {}

    if user_ids:
        # 유저 수가 많을 경우 IN 절을 사용하지 않고 전체 카운트를 집계
        if len(user_ids) > 100:
            res_a = db.query(Matching.user_a_id, func.count(Matching.id)).group_by(Matching.user_a_id).all()
            res_b = db.query(Matching.user_b_id, func.count(Matching.id)).group_by(Matching.user_b_id).all()
        else:
            res_a = db.query(Matching.user_a_id, func.count(Matching.id)).filter(Matching.user_a_id.in_(user_ids)).group_by(Matching.user_a_id).all()
            res_b = db.query(Matching.user_b_id, func.count(Matching.id)).filter(Matching.user_b_id.in_(user_ids)).group_by(Matching.user_b_id).all()

        for uid, c in res_a:
            counts[uid] = counts.get(uid, 0) + c
        for uid, c in res_b:
            counts[uid] = counts.get(uid, 0) + c
    
    for u in users:
        u.match_count = counts.get(u.id, 0)

    return users


# ---------------------------------------------------------------------------
# GET /api/upload/presigned-url – S3 Presigned URL 발급
# ---------------------------------------------------------------------------

@app.get(
    "/api/upload/presigned-url",
    response_model=PresignedUrlResponse,
    summary="S3 업로드용 Presigned URL 발급",
    tags=["upload"],
)
def get_presigned_url(
    filename: str = Query(..., description="원본 파일명 (예: photo.jpg)"),
    content_type: str = Query(..., description="MIME 타입 (예: image/jpeg)"),
):
    """
    S3(AWS S3 / Cloudflare R2 등)에 이미지를 직접 업로드하기 위한 Presigned URL을 반환합니다.
    - S3 환경변수(AWS_ACCESS_KEY_ID 등)가 미설정시 503을 반환합니다.
    - 허용 MIME: image/jpeg, image/png, image/webp
    """
    try:
        from utils.s3 import generate_presigned_upload
        result = generate_presigned_upload(filename, content_type)
        return PresignedUrlResponse(**result)
    except EnvironmentError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ---------------------------------------------------------------------------
# POST /api/admin/login – 관리자 인증 (JWT 발급)
# ---------------------------------------------------------------------------

@app.post(
    "/api/admin/login",
    summary="관리자 로그인",
    tags=["admin"],
)
def admin_login(payload: AdminAuthRequest):
    """
    .env의 ADMIN_PASSWORD와 일치하면 JWT 토큰을 발급합니다.
    ADMIN_PASSWORD가 설정되지 않으면 서비스 사용 불가 상태를 반환합니다.
    """
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="관리자 비밀번호가 설정되지 않았습니다. 서버 환경변수를 확인하세요.",
        )

    # Timing attack 방지를 위해 secrets.compare_digest 사용
    if not secrets.compare_digest(payload.password.encode("utf-8"), admin_password.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="관리자 비밀번호가 올바르지 않습니다.",
        )

    # JWT 생성
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    to_encode = {"sub": "admin", "exp": expire}
    access_token = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return {"access_token": access_token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# DELETE /api/users/{user_id} – 유저 삭제 (관리자 전용)
# ---------------------------------------------------------------------------

@app.delete(
    "/api/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="유저 삭제",
    tags=["users"],
)
def delete_user(user_id: str, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    """
    user_id(UUID)에 해당하는 유저를 영구 삭제합니다.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 유저를 찾을 수 없습니다.",
        )
    
    # 외래키 제약조건 위반 방지를 위해 관련된 매칭 내역을 함께 삭제합니다.
    db.query(Matching).filter(
        (Matching.user_a_id == user_id) | (Matching.user_b_id == user_id)
    ).delete()

    db.delete(user)
    db.commit()


# ---------------------------------------------------------------------------
# Matching 응답 보조기
# ---------------------------------------------------------------------------

def _build_matching_response(matching: Matching, db: Session, prefetched_users: Optional[dict] = None):
    if prefetched_users is not None:
        user_a = prefetched_users.get(matching.user_a_id)
        user_b = prefetched_users.get(matching.user_b_id)
    else:
        user_a = db.query(User).filter(User.id == matching.user_a_id).first()
        user_b = db.query(User).filter(User.id == matching.user_b_id).first()

    return {
        "id": matching.id,
        "user_a_id": matching.user_a_id,
        "user_b_id": matching.user_b_id,
        "user_a_status": matching.user_a_status,
        "user_b_status": matching.user_b_status,
        "ai_score": matching.ai_score,
        "ai_reason": matching.ai_reason,
        "created_at": matching.created_at,
        "user_a_info": user_a,
        "user_b_info": user_b,
        "user_a_token": matching.user_a_token,
        "user_b_token": matching.user_b_token,
        "expires_at": matching.expires_at,
        "is_auto_generated": matching.is_auto_generated,
        "is_contact_shared": matching.is_contact_shared,
    }


# ---------------------------------------------------------------------------
# POST /api/matchings – 수동 매칭 생성
# ---------------------------------------------------------------------------

@app.post(
    "/api/matchings",
    response_model=MatchingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="수동 매칭 생성",
    tags=["matchings"],
)
def create_matching(payload: MatchingCreate, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
    """관리자가 두 유저를 선택하여 새로운 매칭을 생성합니다."""
    user_a = db.query(User).filter(User.id == payload.user_a_id).first()
    user_b = db.query(User).filter(User.id == payload.user_b_id).first()

    if not user_a or not user_b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매칭할 유저를 찾을 수 없습니다.",
        )

    # 항상 문자열 기준으로 정렬해서 저장
    sorted_ids = sorted([payload.user_a_id, payload.user_b_id])
    
    existing = db.query(Matching).filter(
        Matching.user_a_id == sorted_ids[0],
        Matching.user_b_id == sorted_ids[1]
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 매칭된 대상입니다.",
        )

    new_matching = Matching(
        user_a_id=sorted_ids[0],
        user_b_id=sorted_ids[1],
        ai_score=payload.ai_score,
        ai_reason=payload.ai_reason
    )
    
    db.add(new_matching)
    db.commit()
    db.refresh(new_matching)
    
    return _build_matching_response(new_matching, db)


# ---------------------------------------------------------------------------
# POST /api/matchings/generate-daily – AI 자동 매칭 수동 실행
# ---------------------------------------------------------------------------

@app.post(
    "/api/matchings/generate-daily",
    summary="AI 일일 자동 매칭 수동 실행",
    tags=["matchings"],
)
def trigger_generate_daily_matches(_admin: str = Depends(verify_admin)):
    """스케줄러와 동일한 AI 자동 매칭 로직을 즉시 실행합니다. (관리자 전용)"""
    try:
        result = _run_generate_daily_matches()
        return {"message": f"{result['created']}쌍 생성 완료 (시도 {result['attempts']}회)", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"자동 매칭 실행 중 오류가 발생했습니다: {exc}")


# ---------------------------------------------------------------------------
# POST /api/internal/generate-daily – Cloud Scheduler 전용 엔드포인트
# ---------------------------------------------------------------------------

@app.post(
    "/api/internal/generate-daily",
    summary="Cloud Scheduler 전용 AI 자동 매칭 실행",
    tags=["internal"],
    include_in_schema=False,
)
def scheduled_generate_daily_matches(x_scheduler_secret: Optional[str] = Header(None)):
    """GCP Cloud Scheduler가 X-Scheduler-Secret 헤더로 호출하는 전용 엔드포인트."""
    if not _scheduler_secret:
        raise HTTPException(status_code=503, detail="SCHEDULER_SECRET이 서버에 설정되지 않았습니다.")
    if not x_scheduler_secret or not secrets.compare_digest(x_scheduler_secret, _scheduler_secret):
        raise HTTPException(status_code=401, detail="인증 실패")
    try:
        result = _run_generate_daily_matches()
        return {"message": f"{result['created']}쌍 생성 완료 (시도 {result['attempts']}회)", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"자동 매칭 실행 중 오류가 발생했습니다: {exc}")


# ---------------------------------------------------------------------------
# GET /api/matchings – 전체 매칭 리스트 조회
# ---------------------------------------------------------------------------

@app.get(
    "/api/matchings",
    response_model=list[MatchingResponse],
    summary="매칭 전체 조회",
    tags=["matchings"],
)
def list_matchings(
    status_filter: Optional[str] = Query(None, description="상태별 조회 (PENDING, ACCEPTED, REJECTED)"),
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    query = db.query(Matching)
    if status_filter:
        try:
            enum_status = MatchStatus(status_filter)
            query = query.filter(
                (Matching.user_a_status == enum_status) |
                (Matching.user_b_status == enum_status)
            )
        except ValueError:
            pass # Invalid status_filter ignores instead of failing
            
    matchings = query.order_by(Matching.created_at.desc()).all()

    user_ids = {m.user_a_id for m in matchings} | {m.user_b_id for m in matchings}
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    prefetched_users = {u.id: u for u in users}

    results = [_build_matching_response(m, db, prefetched_users=prefetched_users) for m in matchings]
    return results


# ---------------------------------------------------------------------------
# PUT /api/matchings/{matching_id}/status – 매칭 상태 업데이트
# ---------------------------------------------------------------------------

@app.put(
    "/api/matchings/{matching_id}/status",
    response_model=MatchingResponse,
    summary="매칭 응답 업데이트",
    tags=["matchings"],
)
def update_matching_status(
    matching_id: str,
    payload: MatchingUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
) -> MatchingResponse:
    matching = db.query(Matching).filter(Matching.id == matching_id).first()
    if not matching:
        raise HTTPException(status_code=404, detail="매칭 정보를 찾을 수 없습니다.")

    # 어느 유저의 상태를 업데이트할지 확인 (MatchingUpdate 스키마 기반)
    if payload.user_id == matching.user_a_id:
        matching.user_a_status = payload.status
    elif payload.user_id == matching.user_b_id:
        matching.user_b_status = payload.status
    else:
        raise HTTPException(status_code=404, detail="이 매칭에 속하지 않은 유저입니다.")
        
    db.commit()
    db.refresh(matching)
    
    return _build_matching_response(matching, db)


@app.get(
    "/api/matchings/stats/daily",
    response_model=DailyMatchingStatsResponse,
    summary="날짜별 매칭 건수 통계",
    tags=["matchings"],
)
def get_daily_matching_stats(db: Session = Depends(get_db)):
    """
    날짜별로 몇 건의 매칭이 발생했는지 통계를 반환합니다.
    """
    try:
        # 1. 표준 CAST 방식 시도 (PostgreSQL 및 최신 SQLite용)
        date_col = cast(Matching.created_at, Date).label("date")
        stats = (
            db.query(date_col, func.count(Matching.id).label("count"))
            .group_by(date_col)
            .order_by(date_col.desc())
            .all()
        )
        return {"stats": [{"date": str(s.date), "count": s.count} for s in stats if s.date]}
    except Exception as e:
        db.rollback()
        try:
            # 2. SQLite 전용 strftime 방식 시도 (일부 로컬 환경용)
            date_col = func.strftime('%Y-%m-%d', Matching.created_at).label("date")
            stats = (
                db.query(date_col, func.count(Matching.id).label("count"))
                .group_by(date_col)
                .order_by(date_col.desc())
                .all()
            )
            return {"stats": [{"date": str(s.date), "count": s.count} for s in stats if s.date]}
        except Exception as e2:
            db.rollback()
            logger.error(f"Daily stats fallback error: {e2}")
            return {"stats": []}


# ---------------------------------------------------------------------------
# DELETE /api/matchings/{matching_id} – 매칭 삭제 (관리자 전용)
# ---------------------------------------------------------------------------

@app.delete(
    "/api/matchings/{matching_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="매칭 삭제",
    tags=["matchings"],
)
def delete_matching(
    matching_id: str,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    matching_id(UUID)에 해당하는 매칭 정보를 영구 삭제합니다.
    """
    matching = db.query(Matching).filter(Matching.id == matching_id).first()
    if not matching:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매칭 정보를 찾을 수 없습니다.",
        )

    db.delete(matching)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# POST /api/matchings/ai-recommend – AI 기반 매칭 추천 (DB 캐싱)
# ---------------------------------------------------------------------------

@app.post(
    "/api/matchings/ai-recommend",
    response_model=list[AIRecommendResult],
    summary="AI 매칭 추천",
    tags=["matchings"],
)
def ai_recommend_matchings(
    payload: AIRecommendRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    타겟 유저와 후보 유저들의 정보(민감정보 제외)를 비교하여 Gemini AI가 평가한
    적합도 점수와 추천 사유를 반환합니다.
    - **캐싱**: 최근 5건 이력에서 이미 분석된 후보는 DB 값을 재사용합니다.
    - **기존 매칭 이력이 있는 유저는 자동으로 제외됩니다.**
    """
    # 1. 타겟 유저 조회
    target_user = db.query(User).filter(User.id == payload.target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="타겟 유저를 찾을 수 없습니다.")

    # 2. 기 매칭 이력이 있는 후보 제외
    existing_matches = db.query(Matching).filter(
        (Matching.user_a_id == payload.target_user_id) |
        (Matching.user_b_id == payload.target_user_id)
    ).all()
    matched_user_ids = {m.user_a_id for m in existing_matches} | {m.user_b_id for m in existing_matches}
    matched_user_ids.add(payload.target_user_id)  # 자기 자신도 제외

    # 2-1. 현재 다른 매칭이 진행 중인(매칭 종료가 아닌 모든 상태) 후보 제외
    # 진행 중 = (A_status != REJECTED) AND (B_status != REJECTED) AND (is_contact_shared == False)
    busy_matches = db.query(Matching).filter(
        (Matching.user_a_status != MatchStatus.REJECTED) &
        (Matching.user_b_status != MatchStatus.REJECTED) &
        (Matching.is_contact_shared == False)
    ).all()
    busy_user_ids = {m.user_a_id for m in busy_matches} | {m.user_b_id for m in busy_matches}

    valid_candidate_ids = [
        c_id for c_id in payload.candidate_user_ids 
        if c_id not in matched_user_ids and c_id not in busy_user_ids
    ]
    if not valid_candidate_ids:
        return []

    # 3. 유효한 후보 유저들 조회 + 추천인 동일 제외 + 정지 유저 제외
    now_utc = datetime.now(timezone.utc)
    candidates = db.query(User).filter(
        User.id.in_(valid_candidate_ids),
        or_(User.penalty_until.is_(None), User.penalty_until <= now_utc),
    ).all()
    if getattr(target_user, "referrer_name", None):
        candidates = [c for c in candidates if getattr(c, "referrer_name", None) != target_user.referrer_name]
    if not candidates:
        return []

    candidate_id_set = {c.id for c in candidates}  # M: 이번 요청 유효 후보 집합

    # 4. 캐시 조회 – 최근 5건 이력에서 이미 분석된 후보(N) 추출
    recent_histories = (
        db.query(AiRecommendHistory)
        .filter(AiRecommendHistory.target_user_id == payload.target_user_id)
        .order_by(AiRecommendHistory.created_at.desc())
        .limit(10)
        .all()
    )
    cached_results: dict[str, dict] = {}  # { candidate_id: {"score": int, "reason": str} }
    for hist in recent_histories:
        if isinstance(hist.candidate_results, dict):
            for cid, data in hist.candidate_results.items():
                if cid not in cached_results:
                    cached_results[cid] = data

    # 5. M ∩ N (캐시 히트) vs M - N (신규 호출 필요)
    cached_candidate_ids = candidate_id_set & set(cached_results.keys())
    new_candidate_ids = candidate_id_set - cached_candidate_ids

    new_api_results: dict[str, dict] = {}  # 신규 Gemini 호출 결과

    if new_candidate_ids:
        # 6. 신규 후보에 대해서만 Gemini API 호출
        from schemas import UserRead
        exclude_fields = {"name", "referrer_name", "photo_urls"}
        target_dict = UserRead.model_validate(target_user).model_dump(mode='json', exclude=exclude_fields)

        new_candidates = [c for c in candidates if c.id in new_candidate_ids]
        candidates_dict_list = [
            UserRead.model_validate(c).model_dump(mode='json', exclude=exclude_fields)
            for c in new_candidates
        ]

        from utils.gemini import get_ai_recommendations
        try:
            raw_recs = get_ai_recommendations(target_dict, candidates_dict_list)
        except Exception as e:
            logger.error(f"AI 추천 처리 중 에러가 발생했습니다: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="AI 추천 처리 중 에러가 발생했습니다.")

        new_cand_map = {c.id: c for c in new_candidates}
        for rec in raw_recs:
            try:
                parsed = AIRecommendResult(**rec)
                cand = new_cand_map.get(parsed.candidate_id)
                new_api_results[parsed.candidate_id] = {
                    "score": parsed.score,
                    "reason": parsed.reason,
                    "name": cand.name if cand else None,
                    "birth_year": cand.birth_year if cand else None,
                }
            except Exception:
                pass

        # 7. 병합된 최종 결과를 DB에 UPSERT (최신 레코드 덮어쓰기)
        # 기존 캐시에 신규 결과를 병합 (new_api_results가 우선)
        merged_results = {**cached_results, **new_api_results}
        # 이번 요청 후보 범위 전체를 포함 (기존 캐시 + 신규)
        merged_for_db = {cid: merged_results[cid] for cid in merged_results}

        # 가장 최신 레코드가 있으면 UPDATE, 없으면 INSERT
        latest_hist = (
            db.query(AiRecommendHistory)
            .filter(AiRecommendHistory.target_user_id == payload.target_user_id)
            .order_by(AiRecommendHistory.created_at.desc())
            .first()
        )
        if latest_hist:
            # SQLAlchemy JSON 컬럼은 직접 교체해야 변경 감지됨
            from datetime import timezone
            latest_hist.candidate_results = merged_for_db
            latest_hist.created_at = datetime.now(timezone.utc)
            db.add(latest_hist)
        else:
            new_hist = AiRecommendHistory(
                target_user_id=payload.target_user_id,
                candidate_results=merged_for_db,
            )
            db.add(new_hist)
        db.commit()

    # 9. 최종 응답 구성 (캐시 + 신규 결과 병합)
    all_results: list[AIRecommendResult] = []
    for candidate in candidates:
        cid = candidate.id
        if cid in new_api_results:
            data = new_api_results[cid]
        elif cid in cached_results:
            data = cached_results[cid]
        else:
            continue
        try:
            all_results.append(AIRecommendResult(
                candidate_id=cid,
                score=data["score"],
                reason=data["reason"],
            ))
        except Exception:
            pass

    all_results.sort(key=lambda x: x.score, reverse=True)
    return all_results


# ---------------------------------------------------------------------------
# POST /api/matchings/ai-batch-recommend – N:M 배치 AI 매칭 추천
# ---------------------------------------------------------------------------

@app.post(
    "/api/matchings/ai-batch-recommend",
    response_model=list[AIBatchRecommendResultItem],
    summary="N:M 배치 AI 매칭 추천",
    tags=["matchings"],
)
def ai_batch_recommend_matchings(
    payload: AIBatchRecommendRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    N명의 타겟과 M명의 후보를 AI가 전방위 평가하여 최적의 상위 top_n 쌍을 추천합니다.
    - 동일 인물이 두 쌍에 중복 등장하지 않습니다 (Greedy Assignment).
    - 기존 AiRecommendHistory 캐시를 재사용하여 AI 호출을 최소화합니다.
    - 이미 매칭 진행 중인 유저는 자동으로 제외됩니다.
    """
    from schemas import UserRead
    from utils.gemini import get_ai_recommendations
    from concurrent.futures import ThreadPoolExecutor, as_completed

    # 1. 타겟 유저 목록 조회
    targets = db.query(User).filter(User.id.in_(payload.target_user_ids)).all()
    if not targets:
        raise HTTPException(status_code=404, detail="타겟 유저를 찾을 수 없습니다.")

    # 2. 현재 매칭 진행 중인 유저 ID 집합 계산
    busy_matches = db.query(Matching).filter(
        (Matching.user_a_status != MatchStatus.REJECTED) &
        (Matching.user_b_status != MatchStatus.REJECTED) &
        (Matching.is_contact_shared == False)
    ).all()
    busy_user_ids = {m.user_a_id for m in busy_matches} | {m.user_b_id for m in busy_matches}

    # 3. 유효한 타겟 필터링 (진행 중 매칭 제외)
    valid_targets = [t for t in targets if t.id not in busy_user_ids]
    if not valid_targets:
        raise HTTPException(status_code=422, detail="유효한 타겟 유저가 없습니다. 모두 매칭 진행 중입니다.")

    # 4. 후보 유저 목록 조회 (정지 유저 제외)
    _now_utc = datetime.now(timezone.utc)
    candidates_all = db.query(User).filter(
        User.id.in_(payload.candidate_user_ids),
        User.id.notin_(busy_user_ids),
        or_(User.penalty_until.is_(None), User.penalty_until <= _now_utc),
    ).all()
    if not candidates_all:
        raise HTTPException(status_code=422, detail="유효한 후보 유저가 없습니다.")


    # 이미 매칭 이력이 있는 쌍 조회 (재매칭 방지)
    all_involved_ids = {t.id for t in valid_targets} | {c.id for c in candidates_all}
    existing_matches = db.query(Matching).filter(
        (Matching.user_a_id.in_(all_involved_ids)) | (Matching.user_b_id.in_(all_involved_ids))
    ).all()
    existing_pairs: set[frozenset] = {
        frozenset([m.user_a_id, m.user_b_id]) for m in existing_matches
    }

    exclude_fields = {"name", "referrer_name", "photo_urls"}

    # 5. Phase 1: 캐시 조회 및 AI 호출 대상 수집 (DB 작업, 순차)
    # target_task_data: (target, cached_results, new_candidates, valid_candidates)
    target_task_data: list[tuple] = []

    for target in valid_targets:
        tid = target.id
        valid_candidates = [
            c for c in candidates_all
            if getattr(c, "referrer_name", None) != getattr(target, "referrer_name", None)
            and frozenset([tid, c.id]) not in existing_pairs
        ]
        if not valid_candidates:
            target_task_data.append((target, {}, [], [], {}, []))
            continue

        candidate_id_set = {c.id for c in valid_candidates}

        recent_histories = (
            db.query(AiRecommendHistory)
            .filter(AiRecommendHistory.target_user_id == tid)
            .order_by(AiRecommendHistory.created_at.desc())
            .limit(10)
            .all()
        )
        cached_results: dict[str, dict] = {}
        for hist in recent_histories:
            if isinstance(hist.candidate_results, dict):
                for cid, data in hist.candidate_results.items():
                    if cid not in cached_results:
                        cached_results[cid] = data

        new_ids = candidate_id_set - set(cached_results.keys())
        new_candidates = [c for c in valid_candidates if c.id in new_ids]

        if new_candidates:
            target_dict = UserRead.model_validate(target).model_dump(mode='json', exclude=exclude_fields)
            candidates_dict_list = [
                UserRead.model_validate(c).model_dump(mode='json', exclude=exclude_fields)
                for c in new_candidates
            ]
        else:
            target_dict = {}
            candidates_dict_list = []

        target_task_data.append((target, cached_results, new_candidates, valid_candidates, target_dict, candidates_dict_list))

    # Phase 2: AI 호출을 병렬로 실행 (타임아웃 방지)
    def call_ai_for_target(t_dict, c_dict_list):
        return get_ai_recommendations(t_dict, c_dict_list)

    ai_call_results: dict[str, list] = {}  # tid -> raw_recs
    targets_needing_ai = [
        (t, t_dict, c_dict_list) 
        for t, cached, nc, vc, t_dict, c_dict_list in target_task_data 
        if nc
    ]

    if targets_needing_ai:
        with ThreadPoolExecutor(max_workers=min(len(targets_needing_ai), 5)) as executor:
            future_to_tid = {
                executor.submit(call_ai_for_target, t_dict, c_dict_list): t.id
                for t, t_dict, c_dict_list in targets_needing_ai
            }
            errors = []
            for future in as_completed(future_to_tid):
                tid = future_to_tid[future]
                try:
                    ai_call_results[tid] = future.result()
                except Exception as e:
                    errors.append(str(e))
            if errors and not ai_call_results:
                logger.error(f"배치 AI 추천 처리 중 에러: {errors}")
                raise HTTPException(status_code=500, detail="AI 추천 처리 중 에러가 발생했습니다.")

    # Phase 3: 결과 처리, 캐시 업데이트, 점수 행렬 구축 (DB 작업, 순차)
    score_matrix: dict[str, dict[str, dict]] = {}

    for target, cached_results, new_candidates, valid_candidates, t_dict, c_dict_list in target_task_data:
        tid = target.id
        score_matrix[tid] = {}
        if not valid_candidates:
            continue

        candidate_id_set = {c.id for c in valid_candidates}
        new_api_results: dict[str, dict] = {}

        new_cand_map = {c.id: c for c in new_candidates}
        if tid in ai_call_results:
            for rec in ai_call_results[tid]:
                try:
                    parsed = AIRecommendResult(**rec)
                    cand = new_cand_map.get(parsed.candidate_id)
                    new_api_results[parsed.candidate_id] = {
                        "score": parsed.score,
                        "reason": parsed.reason,
                        "name": cand.name if cand else None,
                        "birth_year": cand.birth_year if cand else None,
                    }
                except Exception:
                    pass

            merged = {**cached_results, **new_api_results}
            latest_hist = (
                db.query(AiRecommendHistory)
                .filter(AiRecommendHistory.target_user_id == tid)
                .order_by(AiRecommendHistory.created_at.desc())
                .first()
            )
            if latest_hist:
                latest_hist.candidate_results = merged
                latest_hist.created_at = datetime.now(timezone.utc)
                db.add(latest_hist)
            else:
                db.add(AiRecommendHistory(
                    target_user_id=tid,
                    candidate_results=merged,
                ))
            db.commit()

        for cid in candidate_id_set:
            if cid in new_api_results:
                score_matrix[tid][cid] = new_api_results[cid]
            elif cid in cached_results:
                score_matrix[tid][cid] = cached_results[cid]

    # 6. Greedy Assignment: 점수 높은 순으로 top_n 쌍 선택 (중복 없이)
    # 가능한 모든 (target_id, candidate_id, score) 조합을 점수 내림차순 정렬
    all_pairs: list[tuple[int, str, str, str]] = []  # (score, target_id, candidate_id, reason)
    for tid, cand_scores in score_matrix.items():
        for cid, data in cand_scores.items():
            all_pairs.append((data["score"], tid, cid, data["reason"]))
    all_pairs.sort(key=lambda x: x[0], reverse=True)

    used_targets: set[str] = set()
    used_candidates: set[str] = set()
    selected_pairs: list[dict] = []

    for score, tid, cid, reason in all_pairs:
        if len(selected_pairs) >= payload.top_n:
            break
        if tid in used_targets or cid in used_candidates:
            continue
        used_targets.add(tid)
        used_candidates.add(cid)
        selected_pairs.append({
            "rank": len(selected_pairs) + 1,
            "target_id": tid,
            "candidate_id": cid,
            "score": score,
            "reason": reason,
        })

    if not selected_pairs:
        return []

    # 7. 결과를 AiBatchRecommendHistory에 저장
    batch_hist = AiBatchRecommendHistory(
        target_ids=payload.target_user_ids,
        candidate_ids=payload.candidate_user_ids,
        top_n=payload.top_n,
        results=selected_pairs,
    )
    db.add(batch_hist)
    db.commit()

    # 8. 응답 구성 (유저 정보 포함)
    user_ids_needed = {p["target_id"] for p in selected_pairs} | {p["candidate_id"] for p in selected_pairs}
    users_map: dict[str, User] = {
        u.id: u for u in db.query(User).filter(User.id.in_(user_ids_needed)).all()
    }
    # match_count 주입 (UserReadAdmin 호환)
    from sqlalchemy import func

    match_counts_a = db.query(
        Matching.user_a_id, func.count(Matching.id)
    ).filter(
        Matching.user_a_id.in_(user_ids_needed)
    ).group_by(Matching.user_a_id).all()

    match_counts_b = db.query(
        Matching.user_b_id, func.count(Matching.id)
    ).filter(
        Matching.user_b_id.in_(user_ids_needed)
    ).group_by(Matching.user_b_id).all()

    counts_map = {uid: 0 for uid in user_ids_needed}
    for uid, count in match_counts_a:
        counts_map[uid] += count
    for uid, count in match_counts_b:
        counts_map[uid] += count

    for u in users_map.values():
        u.match_count = counts_map.get(u.id, 0)

    result: list[AIBatchRecommendResultItem] = []
    for pair in selected_pairs:
        target_user = users_map.get(pair["target_id"])
        candidate_user = users_map.get(pair["candidate_id"])
        if not target_user or not candidate_user:
            continue
        result.append(AIBatchRecommendResultItem(
            rank=pair["rank"],
            target_user_id=pair["target_id"],
            candidate_user_id=pair["candidate_id"],
            score=pair["score"],
            reason=pair["reason"],
            target_user=UserReadAdmin.model_validate(target_user),
            candidate_user=UserReadAdmin.model_validate(candidate_user),
        ))

    return result


# ---------------------------------------------------------------------------
# GET /api/matchings/ai-recommend/history – AI 추천 이력 조회 (관리자)
# ---------------------------------------------------------------------------

@app.get(
    "/api/matchings/ai-recommend/history",
    response_model=list[AIRecommendHistoryRead],
    summary="AI 추천 이력 조회 (관리자)",
    tags=["matchings"],
)
def get_ai_recommend_history(
    target_user_id: Optional[str] = Query(None, description="특정 유저 ID로 필터 (없으면 전체)"),
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    전체 또는 특정 target_user_id의 AI 추천 이력을 최신순으로 반환합니다.
    """
    query = db.query(AiRecommendHistory)
    if target_user_id:
        query = query.filter(AiRecommendHistory.target_user_id == target_user_id)
    histories = query.order_by(AiRecommendHistory.created_at.desc()).all()

    # target_user 이름을 한 번에 조회하여 응답에 포함
    user_ids = list({h.target_user_id for h in histories})
    users_map: dict[str, str] = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u.name for u in users}

    result = []
    for h in histories:
        result.append(AIRecommendHistoryRead(
            id=h.id,
            target_user_id=h.target_user_id,
            candidate_results=h.candidate_results or {},
            created_at=h.created_at,
            target_user_name=users_map.get(h.target_user_id),
        ))
    return result


# ---------------------------------------------------------------------------
# PATCH /api/matchings/{matching_id}/contact-shared – 연락처 전달 완료 처리
# ---------------------------------------------------------------------------

@app.patch(
    "/api/matchings/{matching_id}/contact-shared",
    response_model=MatchingResponse,
    summary="연락처 전달 완료 처리 (관리자)",
    tags=["matchings"],
)
def mark_matching_contact_shared(
    matching_id: str,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    관리자가 '메시지 전달 완료 처리(매칭종료)' 버튼을 누를 때 호출됩니다.
    - 양측 수락 시 두 유저를 비활성화합니다.
    - 거절·무응답 만료 유저에게 페널티를 부과하고 3.0점 이상이면 14일 정지합니다.
    """
    matching = db.query(Matching).filter(Matching.id == matching_id).first()
    if not matching:
        raise HTTPException(status_code=404, detail="매칭 정보를 찾을 수 없습니다.")

    now = datetime.now(timezone.utc)

    # 양측 수락 시 비활성화 처리
    if matching.user_a_status == MatchStatus.ACCEPTED and matching.user_b_status == MatchStatus.ACCEPTED:
        db.query(User).filter(User.id.in_([matching.user_a_id, matching.user_b_id])).update(
            {"is_active": False}, synchronize_session=False
        )

    # ── 페널티 부과 ──────────────────────────────────────────────────────────
    # 무응답 만료 여부: expires_at이 과거이고 해당 유저 상태가 PENDING
    is_expired = (
        matching.expires_at is not None
        and (
            matching.expires_at.replace(tzinfo=timezone.utc)
            if matching.expires_at.tzinfo is None
            else matching.expires_at
        ) < now
    )

    penalty_targets: list[tuple[str, float]] = []  # (user_id, points)

    for user_id, user_status in [
        (matching.user_a_id, matching.user_a_status),
        (matching.user_b_id, matching.user_b_status),
    ]:
        if user_status == MatchStatus.REJECTED:
            penalty_targets.append((user_id, 1.0))   # 거절 페널티
        elif user_status == MatchStatus.PENDING and is_expired:
            penalty_targets.append((user_id, 1.5))   # 무응답 만료 페널티

    for user_id, points in penalty_targets:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            continue
        user.penalty_points = (user.penalty_points or 0.0) + points
        user.total_penalty_points = (user.total_penalty_points or 0.0) + points

        # 3.0점 이상 → 14일 정지 트리거
        if user.penalty_points >= 3.0:
            user.penalty_until = now + timedelta(days=14)
            user.suspension_count = (user.suspension_count or 0) + 1
            logger.info(
                f"[Penalty] User {user_id} suspended until {user.penalty_until} "
                f"(suspension #{user.suspension_count})"
            )

    matching.is_contact_shared = True
    db.commit()
    db.refresh(matching)

    matching.user_a_info = db.query(User).filter(User.id == matching.user_a_id).first()
    matching.user_b_info = db.query(User).filter(User.id == matching.user_b_id).first()

    return matching


# ---------------------------------------------------------------------------
# PATCH /api/matchings/{matching_id}/refresh-expiry – 매칭 링크 만료 기한 갱신
# ---------------------------------------------------------------------------

@app.patch(
    "/api/matchings/{matching_id}/refresh-expiry",
    response_model=MatchingResponse,
    summary="매칭 링크 만료 기한 갱신 (관리자)",
    tags=["matchings"],
)
def refresh_matching_expiry(
    matching_id: str,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    관리자가 매칭 제안 메시지를 복사할 때 호출됩니다.
    만료 기한을 현재 시간으로부터 24시간 후로 갱신합니다.
    """
    matching = db.query(Matching).filter(Matching.id == matching_id).first()
    if not matching:
        raise HTTPException(status_code=404, detail="매칭 정보를 찾을 수 없습니다.")

    # 이미 유효기간이 설정된 경우(첫 복사 이후)에는 갱신하지 않음
    if matching.expires_at is None:
        matching.expires_at = datetime.now(timezone.utc) + timedelta(hours=24, minutes=1)
        db.commit()
        db.refresh(matching)

    return _build_matching_response(matching, db)


# ---------------------------------------------------------------------------
# Shared Profile (Link-based) API
# ---------------------------------------------------------------------------

@app.get(
    "/api/shared/{token}",
    response_model=SharedProfileRead,
    summary="공유 받은 프로필 조회",
    tags=["matchings"],
)
def get_shared_profile(token: str, db: Session = Depends(get_db)):
    """
    토큰을 통해 매칭 상대의 프로필을 조회합니다.
    - 24시간 5분 이내만 유효합니다.
    - 이미 응답한 경우 조회할 수 없습니다.
    """
    matching = db.query(Matching).filter(
        (Matching.user_a_token == token) | (Matching.user_b_token == token)
    ).first()

    if not matching:
        raise HTTPException(status_code=404, detail="유효하지 않은 링크입니다.")

    # 1. 만료 시간 체크 (timezone-aware comparison)
    if matching.expires_at:
        expires_at_utc = matching.expires_at
        if expires_at_utc.tzinfo is None:
            expires_at_utc = expires_at_utc.replace(tzinfo=timezone.utc)
        
        if expires_at_utc < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="링크가 만료되었습니다.")

    # 2. 이미 응답했는지 체크
    is_user_a = (matching.user_a_token == token)
    current_status = matching.user_a_status if is_user_a else matching.user_b_status
    if current_status != MatchStatus.PENDING:
        raise HTTPException(status_code=403, detail="이미 응답을 완료한 링크입니다.")

    # 3. 상대방 정보 추출
    other_user_id = matching.user_b_id if is_user_a else matching.user_a_id
    other_user = db.query(User).filter(User.id == other_user_id).first()
    
    if not other_user:
        raise HTTPException(status_code=404, detail="상대방 정보를 찾을 수 없습니다.")

    # 현재 유저(토큰 소유자) 조회 – 정책 동의 상태 확인용
    current_user_id = matching.user_a_id if is_user_a else matching.user_b_id
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # 2026년 기준 나이 계산
    age = 2026 - other_user.birth_year

    return SharedProfileRead(
        age=age,
        birth_year=other_user.birth_year,
        job=other_user.job,
        height=other_user.height,
        active_area=other_user.active_area,
        education=other_user.education,
        workplace=other_user.workplace,
        mbti=other_user.mbti,
        religion=other_user.religion,
        smoking_status=other_user.smoking_status,
        drinking_status=other_user.drinking_status,
        exercise=other_user.exercise,
        hobbies=other_user.hobbies,
        ai_reason=matching.ai_reason,
        photo_urls=other_user.photo_urls or [],
        expires_at=matching.expires_at,
        current_user_id=current_user_id,
        has_agreed_penalty_policy=getattr(current_user, "has_agreed_penalty_policy", False) or False,
    )


# ---------------------------------------------------------------------------
# PATCH /api/users/{user_id}/agree-policy – 페널티 정책 동의 처리
# ---------------------------------------------------------------------------

@app.patch(
    "/api/users/{user_id}/agree-policy",
    summary="페널티 정책 동의 처리",
    tags=["users"],
)
def agree_penalty_policy(user_id: str, db: Session = Depends(get_db)):
    """
    유저가 매칭 페널티 정책에 동의했음을 기록합니다.
    has_agreed_penalty_policy를 True로 업데이트합니다.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 유저를 찾을 수 없습니다.",
        )
    user.has_agreed_penalty_policy = True
    db.commit()
    return {"message": "정책 동의가 완료되었습니다."}


@app.post(
    "/api/shared/{token}/respond",
    summary="매칭 수락/거절 응답",
    tags=["matchings"],
)
def respond_shared_matching(
    token: str,
    payload: MatchRespondRequest,
    db: Session = Depends(get_db)
):
    """
    공유 받은 프로필 링크에서 수락(ACCEPTED) 또는 거절(REJECTED)을 결정합니다.
    - 양측 모두 수락 시 두 사용자 모두 비활성화(is_active=False) 처리됩니다.
    """
    matching = db.query(Matching).filter(
        (Matching.user_a_token == token) | (Matching.user_b_token == token)
    ).first()

    if not matching:
        raise HTTPException(status_code=404, detail="유효하지 않은 링크입니다.")

    # 만료 체크 (timezone-aware comparison)
    if matching.expires_at:
        expires_at_utc = matching.expires_at
        if expires_at_utc.tzinfo is None:
            expires_at_utc = expires_at_utc.replace(tzinfo=timezone.utc)
            
        if expires_at_utc < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="링크가 만료되었습니다.")

    is_user_a = (matching.user_a_token == token)
    
    # 이미 응답했는지 체크
    if (is_user_a and matching.user_a_status != MatchStatus.PENDING) or \
       (not is_user_a and matching.user_b_status != MatchStatus.PENDING):
        raise HTTPException(status_code=403, detail="이미 응답한 요청입니다.")

    # 상태 업데이트
    if is_user_a:
        matching.user_a_status = payload.status
        # 토큰 즉시 만료 처리 (재사용 방지)
        matching.user_a_token = None
    else:
        matching.user_b_status = payload.status
        # 토큰 즉시 만료 처리 (재사용 방지)
        matching.user_b_token = None

    # 비활성화 로직은 관리자가 '연락처 전달 완료' 버튼을 누를 때 수행하도록 변경됨

    db.commit()
    return {"message": "정상적으로 처리되었습니다.", "status": payload.status}
# ---------------------------------------------------------------------------
# Notice (공지사항) API
# ---------------------------------------------------------------------------

@app.get(
    "/api/notices/latest-popup",
    response_model=Optional[NoticeRead],
    summary="가장 최근 팝업 공지 조회",
    tags=["notices"],
)
def get_latest_popup_notice(db: Session = Depends(get_db)):
    """
    is_popup이 True인 공지 중 가장 최근의 데이터를 하나만 반환합니다.
    없으면 None을 반환합니다.
    """
    notice = db.query(Notice).filter(Notice.is_popup == True).order_by(Notice.created_at.desc()).first()
    return notice


@app.post(
    "/api/notices",
    response_model=NoticeRead,
    status_code=status.HTTP_201_CREATED,
    summary="공지사항 작성 (관리자)",
    tags=["notices"],
)
def create_notice(
    payload: NoticeCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """관리자가 새로운 공지사항을 등록합니다."""
    new_notice = Notice(**payload.model_dump())
    db.add(new_notice)
    db.commit()
    db.refresh(new_notice)
    return new_notice


@app.get(
    "/api/notices",
    response_model=list[NoticeRead],
    summary="공지사항 목록 조회 (전체 공개)",
    tags=["notices"],
)
def list_notices(
    db: Session = Depends(get_db),
):
    """모든 공지사항 목록을 최신순으로 반환합니다. (누구나 조회 가능)"""
    return db.query(Notice).order_by(Notice.created_at.desc()).all()


@app.put(
    "/api/notices/{notice_id}",
    response_model=NoticeRead,
    summary="공지사항 수정 (관리자)",
    tags=["notices"],
)
def update_notice(
    notice_id: int,
    payload: NoticeUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """관리자가 공지사항의 제목, 내용, 팝업 여부를 수정합니다."""
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(notice, key, value)

    db.commit()
    db.refresh(notice)
    return notice


@app.delete(
    "/api/notices/{notice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="공지사항 삭제 (관리자)",
    tags=["notices"],
)
def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """공지사항을 영구 삭제합니다."""
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    db.delete(notice)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# PATCH /api/admin/users/{user_id}/penalty – 페널티 수동 수정 (관리자 전용)
# ---------------------------------------------------------------------------

@app.patch(
    "/api/admin/users/{user_id}/penalty",
    response_model=UserReadAdmin,
    summary="페널티 수동 수정 (관리자)",
    tags=["admin"],
)
def update_user_penalty(
    user_id: str,
    payload: PenaltyUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    관리자가 특정 유저의 페널티 관련 필드를 수동으로 수정합니다.

    - **penalty_points**: 현재 활성 페널티 점수를 강제 설정합니다.
    - **total_penalty_points**: 누적 페널티 점수를 강제 설정합니다.
    - **suspension_count**: 정지 처분 누적 횟수를 강제 설정합니다.
    - **penalty_until**: 정지 해제 일시를 설정합니다. `null`을 전달하면 정지가 즉시 해제됩니다.

    전달된 필드만 업데이트되며 나머지는 유지됩니다.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 유저를 찾을 수 없습니다.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    user.match_count = db.query(Matching).filter(
        or_(Matching.user_a_id == user_id, Matching.user_b_id == user_id)
    ).count()
    return user

