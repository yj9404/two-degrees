"""
main.py
TwoDegrees FastAPI 애플리케이션 엔트리포인트
"""

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Gender, User
from schemas import (
    AuthRequest,
    AuthResponse,
    UserCreate,
    UserReadAdmin,
    UserUpdate,
)

# ---------------------------------------------------------------------------
# 앱 초기화 및 테이블 자동 생성
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TwoDegrees API",
    description="소개팅 풀 등록 및 관리 API",
    version="0.2.0",
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
    # 연락처 중복 검사
    existing = db.query(User).filter(User.contact == payload.contact).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
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
    - 성공 시 해당 유저의 id(UUID)와 name을 반환합니다.
    - 실패 시 401을 반환합니다. (보안: 계정 존재 여부를 노출하지 않습니다.)
    """
    user = db.query(User).filter(User.contact == payload.contact).first()

    # 유저 미존재 또는 비밀번호 불일치 — 동일 에러 메시지로 정보 누출 방지
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="연락처 또는 비밀번호가 올바르지 않습니다.",
        )

    return AuthResponse(user_id=user.id, name=user.name)


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
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
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
    db: Session = Depends(get_db),
):
    """
    등록된 유저 목록을 반환합니다. 쿼리 파라미터로 복합 필터링을 지원합니다.

    - **gender**: MALE 또는 FEMALE
    - **birth_year_min / birth_year_max**: 출생연도 범위 (예: 1990~2000)
    - **active_area**: 부분 문자열 일치 검색 (예: \"강남\" → \"서울 강남구\" 매칭)
    - **is_active**: true이면 매칭 풀에 활성화된 유저만 조회
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

    return query.all()
