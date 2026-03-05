"""
schemas.py
Pydantic v2 기반 요청·응답 스키마 정의
- UserCreate    : 등록 요청 바디 (password 포함)
- UserUpdate    : 부분 수정 요청 바디 (is_active 포함, 모든 필드 Optional)
- UserRead      : 일반 응답 (contact, password_hash 미포함)
- UserReadAdmin : 관리자 응답 (contact 포함, password_hash 제외)
- AuthRequest   : 인증 요청 바디
- AuthResponse  : 인증 응답 (user_id 반환)
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models import Gender, SmokingStatus


# ---------------------------------------------------------------------------
# 공통 베이스 (공유 필드 정의)
# ---------------------------------------------------------------------------

class _UserBase(BaseModel):
    name: str = Field(..., max_length=50, examples=["홍길동"])
    gender: Gender
    birth_year: int = Field(..., ge=1940, le=2010, examples=[1995])
    job: str = Field(..., max_length=100, examples=["개발자"])
    referrer_name: str = Field(..., max_length=50, examples=["김철수"])
    desired_conditions: str = Field(..., min_length=10, examples=["성격이 밝고 유머 감각이 있는 분"])
    deal_breakers: str = Field(..., min_length=10, examples=["흡연자, 종교 강요"])

    # 선택 항목
    instagram_id: Optional[str] = Field(None, max_length=100, examples=["__instagram_id__"])
    photo_urls: List[str] = Field(default_factory=list)
    height: Optional[int] = Field(None, ge=140, le=220)
    active_area: Optional[str] = Field(None, max_length=100, examples=["서울 강남"])
    education: Optional[str] = Field(None, max_length=100, examples=["서울대 컴퓨터공학과"])
    workplace: Optional[str] = Field(None, max_length=100, examples=["판교"])
    smoking_status: Optional[SmokingStatus] = None
    religion: Optional[str] = Field(None, max_length=50, examples=["무교"])

    @field_validator("photo_urls", mode="before")
    @classmethod
    def coerce_photo_urls(cls, v):
        """DB에서 NULL로 조회되는 경우 빈 리스트로 정규화합니다."""
        if v is None:
            return []
        return v


# ---------------------------------------------------------------------------
# 등록 요청 스키마
# ---------------------------------------------------------------------------

class UserCreate(_UserBase):
    """POST /api/users 요청 바디"""

    contact: str = Field(..., max_length=100, examples=["010-1234-5678"])
    password: str = Field(..., min_length=4, max_length=100, examples=["mypassword"])

    @field_validator("birth_year")
    @classmethod
    def birth_year_reasonable(cls, v: int) -> int:
        # 만 18세 미만 차단 (기준 연도: 2026)
        if v > 2008:
            raise ValueError("만 18세 이상만 등록할 수 있습니다.")
        return v


# ---------------------------------------------------------------------------
# 부분 수정 요청 스키마
# ---------------------------------------------------------------------------

class UserUpdate(BaseModel):
    """PUT /api/users/{user_id} 요청 바디 – 모든 필드 Optional"""

    name: Optional[str] = Field(None, max_length=50)
    gender: Optional[Gender] = None
    birth_year: Optional[int] = Field(None, ge=1940, le=2010)
    job: Optional[str] = Field(None, max_length=100)
    referrer_name: Optional[str] = Field(None, max_length=50)
    desired_conditions: Optional[str] = None
    deal_breakers: Optional[str] = None
    instagram_id: Optional[str] = Field(None, max_length=100)
    photo_urls: Optional[List[str]] = None  # None = 변경 없음
    height: Optional[int] = Field(None, ge=140, le=220)
    active_area: Optional[str] = Field(None, max_length=100)
    education: Optional[str] = Field(None, max_length=100)
    workplace: Optional[str] = Field(None, max_length=100)
    smoking_status: Optional[SmokingStatus] = None
    religion: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# 인증 요청/응답 스키마
# ---------------------------------------------------------------------------

class AuthRequest(BaseModel):
    """POST /api/users/auth 요청 바디"""

    contact: str = Field(..., max_length=100, examples=["010-1234-5678"])
    password: str = Field(..., min_length=4, max_length=100)


class AuthResponse(BaseModel):
    """POST /api/users/auth 응답 – 인증 성공 시 user_id 반환"""

    user_id: str
    name: str


class AdminAuthRequest(BaseModel):
    """POST /api/admin/auth 요청 바디"""

    password: str


class PresignedUrlResponse(BaseModel):
    """GET /api/upload/presigned-url 응답"""

    presigned_url: str
    object_key: str
    public_url: str


# ---------------------------------------------------------------------------
# 응답 스키마 – password_hash는 절대 노출하지 않음
# ---------------------------------------------------------------------------

class UserRead(_UserBase):
    """일반 응답 – contact(개인정보) 및 password_hash 미포함"""

    id: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserReadAdmin(UserRead):
    """관리자 응답 – contact 포함, password_hash 제외"""

    contact: str

    model_config = ConfigDict(from_attributes=True)
