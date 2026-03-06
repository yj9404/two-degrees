"""
models.py
TwoDegrees 소개팅 풀 등록을 위한 SQLAlchemy ORM 모델
"""

import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.dialects.sqlite import TEXT as UUID_TEXT

from database import Base


# ---------------------------------------------------------------------------
# Enum 정의
# ---------------------------------------------------------------------------

class Gender(PyEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class SmokingStatus(PyEnum):
    NON_SMOKER = "NON_SMOKER"
    SMOKER = "SMOKER"


class DrinkingStatus(PyEnum):
    NON_DRINKER = "NON_DRINKER"       # 비음주
    SOCIAL_DRINKER = "SOCIAL_DRINKER" # 가끔 (회식 등)
    DRINKER = "DRINKER"               # 음주


# ---------------------------------------------------------------------------
# User 모델
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    # ── 식별자 ──────────────────────────────────────────────────────────────
    # SQLite는 네이티브 UUID 타입을 지원하지 않으므로 TEXT로 저장합니다.
    # 운영 DB(PostgreSQL 등)로 전환 시 UUID 타입으로 교체하십시오.
    id = Column(
        UUID_TEXT,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )

    # ── 필수 항목 (nullable=False) ───────────────────────────────────────────
    name = Column(String(50), nullable=False)
    gender = Column(Enum(Gender), nullable=False)
    birth_year = Column(Integer, nullable=False)          # 나이 계산용 (예: 1995)
    job = Column(String(100), nullable=False)
    contact = Column(String(100), nullable=False, unique=True)  # 로그인 식별자, 중복 방지
    password_hash = Column(String(200), nullable=False)   # bcrypt 해시 비밀번호
    referrer_name = Column(String(50), nullable=False)    # 초대한 지인 이름 (신원 보증)
    desired_conditions = Column(Text, nullable=False)     # 원하는 상대방 조건
    deal_breakers = Column(Text, nullable=False)          # 절대 기피 조건
    is_active = Column(Boolean, nullable=False, default=True)  # 매칭 풀 노출 여부

    # ── 선택 항목 (nullable=True) ────────────────────────────────────────────
    instagram_id = Column(String(100), nullable=True)     # 인스타그램 아이디
    photo_urls = Column(JSON, nullable=True, default=list) # 사진 URL 목록 (JSON 배열)
    height = Column(Integer, nullable=True)               # 키 (cm)
    active_area = Column(String(100), nullable=True)      # 주 활동 지역
    education = Column(String(100), nullable=True)        # 학력
    workplace = Column(String(100), nullable=True)        # 직장 위치
    mbti = Column(String(4), nullable=True)               # MBTI
    smoking_status = Column(Enum(SmokingStatus), nullable=True)
    drinking_status = Column(Enum(DrinkingStatus), nullable=True)
    religion = Column(String(50), nullable=True)
    exercise = Column(String(100), nullable=True)         # 운동 (예: 주 3회 헬스)
    hobbies = Column(String(200), nullable=True)          # 취미
    intro = Column(Text, nullable=True)                   # 간단한 자기소개
    age_preference = Column(JSON, nullable=True)         # ["OLDER", "SAME"] 등 다중 선택
    age_gap_older = Column(Integer, nullable=True)        # 연상 허용 최대 나이차 (세)
    age_gap_younger = Column(Integer, nullable=True)      # 연하 허용 최대 나이차 (세)

    def __repr__(self) -> str:
        return f"<User id={self.id!r} name={self.name!r} gender={self.gender}>"
