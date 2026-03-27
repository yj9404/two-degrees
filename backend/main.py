"""
main.py
TwoDegrees FastAPI 애플리케이션 엔트리포인트
"""

from typing import Optional
import os
import secrets
import hashlib
import jwt
from datetime import datetime, timedelta, timezone

import httpx

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date

from database import Base, engine, get_db
from models import Gender, User, Matching, MatchStatus, Notice
from schemas import (
    AdminAuthRequest,
    AIRecommendRequest,
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
    PresignedUrlResponse,
    SharedProfileRead,
    UserCreate,
    UserReadAdmin,
    UserStatsResponse,
    UserUpdate,
)

# ---------------------------------------------------------------------------
# 앱 초기화 및 테이블 자동 생성
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TwoDegrees API",
    description="소개팅 풀 등록 및 관리 API",
    version="1.0.4",
)

# 개발 편의를 위해 CORS 전체 허용 (운영 시 origins 제한 필요)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB 테이블이 없으면 자동 생성
Base.metadata.create_all(bind=engine)

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
def get_user_stats(db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
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
def get_user(user_id: str, db: Session = Depends(get_db), _admin: str = Depends(verify_admin)):
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
    _admin: str = Depends(verify_admin),
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

    from sqlalchemy import or_
    user.match_count = db.query(Matching).filter(or_(Matching.user_a_id == user_id, Matching.user_b_id == user_id)).count()
    return user


# ---------------------------------------------------------------------------
# GET /api/users – 전체 유저 목록 조회 (관리자용)
# ---------------------------------------------------------------------------

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
    """
    if birth_year_min and birth_year_max and birth_year_min > birth_year_max:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="birth_year_min이 birth_year_max보다 클 수 없습니다.",
        )

    query = db.query(User)

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
        from models import SmokingStatus
        try:
            enum_status = SmokingStatus(smoking_status)
            query = query.filter(User.smoking_status == enum_status)
        except ValueError:
            pass # Invalid smoking_status ignores instead of failing

    users = query.all()

    # 전체 매칭 조회하여 파이썬 단에서 카운트 집계
    from collections import Counter
    all_matchings = db.query(Matching.user_a_id, Matching.user_b_id).all()
    counts = Counter()
    for a, b in all_matchings:
        counts[a] += 1
        counts[b] += 1
    
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
            detail="매칭하려는 유저를 찾을 수 없습니다.",
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
            print(f"Daily stats fallback error: {e2}")
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
# POST /api/matchings/ai-recommend – AI 기반 매칭 추천 (Stateless)
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
    타겟 유저와 후보 유저들의 정보(민감정보 제외)를 비교하여 
    Gemini AI가 평가한 적합도 점수와 추천 사유를 반환합니다. 
    **기존 매칭 이력이 있는 유저는 자동으로 제외됩니다.**
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
    matched_user_ids.add(payload.target_user_id) # 자기 자신도 제외

    valid_candidate_ids = [c_id for c_id in payload.candidate_user_ids if c_id not in matched_user_ids]
    
    if not valid_candidate_ids:
        return []

    # 3. 유효한 후보 유저들 조회
    candidates = db.query(User).filter(User.id.in_(valid_candidate_ids)).all()
    
    # 타겟 유저와 추천인이 같은 경우 매칭 후보에서 제외
    if getattr(target_user, "referrer_name", None):
        candidates = [c for c in candidates if getattr(c, "referrer_name", None) != target_user.referrer_name]

    if not candidates:
        return []

    # 4. 프롬프트용 데이터 필터링 (JSON으로 직렬화할 수 있도록 Pydantic 모델을 활용)
    from schemas import UserRead
    
    # UserRead는 이름, 연락처(X), 비밀번호(X)를 다루며, 
    # 이름과 지인이름도 추가로 프롬프트에서 가려주기 위해 exclude 처리합니다.
    exclude_fields = {"name", "referrer_name", "photo_urls"}
    target_dict = UserRead.model_validate(target_user).model_dump(mode='json', exclude=exclude_fields)

    candidates_dict_list = [
        UserRead.model_validate(c).model_dump(mode='json', exclude=exclude_fields)
        for c in candidates
    ]

    # 5. Gemini API 연동 모듈 호출
    from utils.gemini import get_ai_recommendations
    try:
        recommendations = get_ai_recommendations(target_dict, candidates_dict_list)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 추천 처리 중 에러가 발생했습니다: {str(e)}")

    # 6. 결과 검증 및 정렬
    valid_results = []
    for rec in recommendations:
        try:
            # 반환된 딕셔너리가 AIRecommendResult 규칙(candidate_id, score, reason)을 만족하는지 파싱
            parsed = AIRecommendResult(**rec)
            valid_results.append(parsed)
        except Exception:
            # 규칙에 맞지 않으면 무시
            pass

    # 점수 내림차순 정렬
    valid_results.sort(key=lambda x: x.score, reverse=True)
    return valid_results


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
    관리자가 매칭된 유저들에게 수동으로 연락처를 전달했음을 기록합니다.
    양쪽 유저의 상태가 모두 ACCEPTED여야만 호출 가능합니다.
    """
    matching = db.query(Matching).filter(Matching.id == matching_id).first()
    if not matching:
        raise HTTPException(status_code=404, detail="매칭 정보를 찾을 수 없습니다.")

    # 양측 유저 수락 시 비활성화 처리 (수동 체크 시점에 수행)
    if matching.user_a_status == MatchStatus.ACCEPTED and matching.user_b_status == MatchStatus.ACCEPTED:
        db.query(User).filter(User.id.in_([matching.user_a_id, matching.user_b_id])).update({"is_active": False}, synchronize_session=False)

    matching.is_contact_shared = True
    db.commit()
    db.refresh(matching)
    
    # MatchingResponse 스키마에 맞춰 user_a_info, user_b_info를 주입하기 위해 속성을 탐색합니다.
    # (SQLAlchemy relationship이 정의되어 있지 않다면 수동으로 fetch하여 부착해야 할 수 있습니다.)
    # models.py를 다시 확인해보면 relationship이 없습니다. main.py의 다른 list_matchings 로직을 보죠.
    
    # User 정보를 가져와서 Matching 객체에 임시 속성으로 부착 (MatchingResponse 매핑용)
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
        expires_at=matching.expires_at
    )


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
