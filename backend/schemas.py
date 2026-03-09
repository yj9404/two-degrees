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

from datetime import datetime
from models import DrinkingStatus, Gender, SmokingStatus, MatchStatus


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
    mbti: Optional[str] = Field(None, max_length=4, examples=["ENFP"])
    smoking_status: Optional[SmokingStatus] = None
    drinking_status: Optional[DrinkingStatus] = None
    religion: Optional[str] = Field(None, max_length=50, examples=["무교"])
    exercise: Optional[str] = Field(None, max_length=100, examples=["주 3회 헬스"])
    hobbies: Optional[str] = Field(None, max_length=200, examples=["등산, 싸이클링"])
    intro: Optional[str] = Field(None, max_length=500, examples=["안녕하세요, 저는..."])
    age_preference: Optional[List[str]] = Field(None, examples=[["OLDER", "SAME"]])  # 다중 선택
    age_gap_older: Optional[int] = Field(None, ge=1, le=20, examples=[5])   # 연상 최대 나이차
    age_gap_younger: Optional[int] = Field(None, ge=1, le=20, examples=[3]) # 연하 최대 나이차

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
    mbti: Optional[str] = Field(None, max_length=4)
    smoking_status: Optional[SmokingStatus] = None
    drinking_status: Optional[DrinkingStatus] = None
    religion: Optional[str] = Field(None, max_length=50)
    exercise: Optional[str] = Field(None, max_length=100)
    hobbies: Optional[str] = Field(None, max_length=200)
    intro: Optional[str] = None
    age_preference: Optional[List[str]] = None
    age_gap_older: Optional[int] = Field(None, ge=1, le=20)
    age_gap_younger: Optional[int] = Field(None, ge=1, le=20)
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


class UserStatsResponse(BaseModel):
    """GET /api/users/stats 응답"""

    total_active: int
    total_users: int
    total_matchings: int
    male_active: int
    female_active: int
    male_ratio: float
    female_ratio: float


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


# ---------------------------------------------------------------------------
# Matching 스키마
# ---------------------------------------------------------------------------

class MatchingCreate(BaseModel):
    """POST /api/matchings 요청 바디"""
    user_a_id: str
    user_b_id: str
    ai_score: Optional[int] = Field(None, ge=0, le=100)
    ai_reason: Optional[str] = None


class MatchingUpdate(BaseModel):
    """PUT /api/matchings/{matching_id}/status 요청 바디"""
    user_id: str
    status: MatchStatus


class MatchingResponse(BaseModel):
    """GET /api/matchings 응답 바디 (단건)"""
    id: str
    user_a_id: str
    user_b_id: str
    user_a_status: MatchStatus
    user_b_status: MatchStatus
    ai_score: Optional[int] = None
    ai_reason: Optional[str] = None
    created_at: datetime
    user_a_token: Optional[str] = None
    user_b_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_contact_shared: bool = False

    # 관리자 확인용 간략한 유저 정보 포함
    user_a_info: UserReadAdmin
    user_b_info: UserReadAdmin

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# AI Recommendation 스키마
# ---------------------------------------------------------------------------

class AIRecommendRequest(BaseModel):
    """POST /api/matchings/ai-recommend 요청 바디"""
    target_user_id: str
    candidate_user_ids: List[str]


class AIRecommendResult(BaseModel):
    """AI 추천 개별 결과"""
    candidate_id: str
    score: int = Field(..., ge=0, le=100)
    reason: str


# ---------------------------------------------------------------------------
# Shared Profile (Link-based) 스키마
# ---------------------------------------------------------------------------

class SharedProfileRead(BaseModel):
    """24시간 프로필 공유 링크를 통해 조회되는 상대방의 제한된 프로필 정보"""
    age: int
    birth_year: int
    job: str
    height: Optional[int] = None
    active_area: Optional[str] = None
    education: Optional[str] = None
    workplace: Optional[str] = None
    mbti: Optional[str] = None
    religion: Optional[str] = None
    smoking_status: Optional[SmokingStatus] = None
    drinking_status: Optional[DrinkingStatus] = None
    exercise: Optional[str] = None
    hobbies: Optional[str] = None
    ai_reason: Optional[str] = None
    photo_urls: List[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None


class MatchRespondRequest(BaseModel):
    """프로필 링크에서 수락/거절 응답을 위한 요청 바디"""
    status: MatchStatus # ACCEPTED or REJECTED

class DailyMatchingStats(BaseModel):
    """날짜별 매칭 통계 개별 항목"""
    date: str
    count: int

class DailyMatchingStatsResponse(BaseModel):
    """날짜별 매칭 통계 응답"""
    stats: List[DailyMatchingStats]
