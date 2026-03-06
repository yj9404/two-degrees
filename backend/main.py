"""
main.py
TwoDegrees FastAPI 애플리케이션 엔트리포인트
"""

from typing import Optional
import os
import urllib.parse

import httpx

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import Base, engine, get_db
from models import Gender, User, Matching, MatchStatus
from schemas import (
    AdminAuthRequest,
    AuthRequest,
    AuthResponse,
    PresignedUrlResponse,
    UserCreate,
    UserReadAdmin,
    UserStatsResponse,
    UserUpdate,
    MatchingCreate,
    MatchingUpdate,
    MatchingResponse,
)

# ---------------------------------------------------------------------------
# 앱 초기화 및 테이블 자동 생성
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TwoDegrees API",
    description="소개팅 풀 등록 및 관리 API",
    version="0.0.3",
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
    현재 매칭풀에 활성화(is_active=True)된 유저들의 남녀 활동 비율을 반환합니다.
    """
    active_users = db.query(User).filter(User.is_active == True).all()
    male_count = sum(1 for u in active_users if u.gender == Gender.MALE)
    female_count = sum(1 for u in active_users if u.gender == Gender.FEMALE)
    total = male_count + female_count

    male_ratio = round((male_count / total * 100)) if total > 0 else 0
    female_ratio = round((female_count / total * 100)) if total > 0 else 0

    return {
        "total_active": total,
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
# POST /api/admin/auth – 관리자 인증
# ---------------------------------------------------------------------------

@app.post(
    "/api/admin/auth",
    summary="관리자 인증",
    tags=["admin"],
)
def admin_auth(payload: AdminAuthRequest):
    """
    .env의 ADMIN_PASSWORD와 일치하면 인증 성공.
    ADMIN_PASSWORD가 설정되지 않으면 서비스 사용 불가 상태를 반환합니다.
    """
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="관리자 비밀번호가 설정되지 않았습니다. 서버 환경변수를 확인하세요.",
        )

    if payload.password != admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="관리자 비밀번호가 올바르지 않습니다.",
        )

    return {"ok": True}


# ---------------------------------------------------------------------------
# DELETE /api/users/{user_id} – 유저 삭제 (관리자 전용)
# ---------------------------------------------------------------------------

@app.delete(
    "/api/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="유저 삭제 (관리자)",
    tags=["admin"],
)
def delete_user(user_id: str, db: Session = Depends(get_db)):
    """
    user_id(UUID)에 해당하는 유저를 영구 삭제합니다.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 유저를 찾을 수 없습니다.",
        )
    db.delete(user)
    db.commit()


# ---------------------------------------------------------------------------
# GET /api/admin/photos/proxy – 이미지 프록시 (강제 다운로드)
# ---------------------------------------------------------------------------

@app.get(
    "/api/admin/photos/proxy",
    summary="이미지 프록시 다운로드 (CORS 우회)",
    tags=["admin"],
)
def proxy_photo(
    url: str = Query(..., description="다운로드할 이미지 Public URL"),
    name: str = Query("photo", description="저장 파일명 (확장자 제외)"),
):
    """
    Cloudflare R2 등 cross-origin 이미지를 브라우저가 직접 다운로드할 수 있도록
    백엔드가 프록시로 가져와 Content-Disposition: attachment로 응답합니다.
    """
    try:
        resp = httpx.get(url, timeout=30, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    content_type = resp.headers.get("content-type", "image/jpeg")
    raw_ext = content_type.split("/")[-1].split(";")[0].lower()

    # jfif, pjpeg 등 JPEG 계열을 모두 jpg로 통일
    MIME_TO_EXT = {
        "jpeg": "jpg", "jfif": "jpg", "pjpeg": "jpg", "jpg": "jpg",
        "png": "png", "webp": "webp", "gif": "gif",
    }
    ext = MIME_TO_EXT.get(raw_ext, "jpg")
    normalized_content_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"

    safe_name = urllib.parse.quote(f"{name}.{ext}")
    headers = {
        "Content-Disposition": f'attachment; filename*=UTF-8\'\'{safe_name}',
        "Content-Type": normalized_content_type,
    }
    return StreamingResponse(iter([resp.content]), media_type=normalized_content_type, headers=headers)


# ---------------------------------------------------------------------------
# Matching 응답 보조기
# ---------------------------------------------------------------------------

def _build_matching_response(matching: Matching, db: Session):
    user_a = db.query(User).filter(User.id == matching.user_a_id).first()
    user_b = db.query(User).filter(User.id == matching.user_b_id).first()
    return {
        "id": matching.id,
        "user_a_id": matching.user_a_id,
        "user_b_id": matching.user_b_id,
        "user_a_status": matching.user_a_status,
        "user_b_status": matching.user_b_status,
        "created_at": matching.created_at,
        "user_a_info": user_a,
        "user_b_info": user_b,
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
def create_matching(payload: MatchingCreate, db: Session = Depends(get_db)):
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
        user_b_id=sorted_ids[1]
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
    db: Session = Depends(get_db)
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
    results = [_build_matching_response(m, db) for m in matchings]
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
    db: Session = Depends(get_db)
):
    matching = db.query(Matching).filter(Matching.id == matching_id).first()
    if not matching:
        raise HTTPException(status_code=404, detail="매칭 정보를 찾을 수 없습니다.")

    if payload.user_id == matching.user_a_id:
        matching.user_a_status = payload.status
    elif payload.user_id == matching.user_b_id:
        matching.user_b_status = payload.status
    else:
        raise HTTPException(status_code=404, detail="이 매칭에 속하지 않은 유저입니다.")
        
    db.commit()
    db.refresh(matching)
    
    return _build_matching_response(matching, db)
