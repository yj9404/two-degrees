"""
database.py
SQLAlchemy 엔진 및 세션 설정 (개발용 SQLite)
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# .env 파일 로드 (개발 환경 등)
load_dotenv()

# 우선적으로 .env의 DATABASE_URL을 사용하고, 없다면 로컬 SQLite 사용
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./twodegrees.db")

# PostgreSQL일 땐 TCP Keepalive 활성화, SQLite일 땐 check_same_thread 지정
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Neon 등 서버리스 PostgreSQL은 유휴 커넥션을 끊을 수 있음.
    # OS 레벨 TCP Keepalive로 30초마다 연결 유지 패킷을 보내 방지.
    connect_args = {
        "keepalives": 1,
        "keepalives_idle": 30,      # 30초 유휴 후 keepalive 시작
        "keepalives_interval": 10,  # 10초마다 재시도
        "keepalives_count": 5,      # 5회 무응답 시 끊김 처리
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # 풀에서 꺼낼 때 커넥션 유효성 확인
    pool_recycle=1800,   # 30분마다 커넥션 강제 교체 (Neon 세션 타임아웃 대비)
)

# 각 요청마다 독립된 DB 세션을 생성합니다.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# 모든 모델이 상속받을 베이스 클래스
Base = declarative_base()


def get_db():
    """
    FastAPI Dependency Injection용 세션 생성기.
    요청 처리 후 세션을 반드시 닫아 커넥션 누수를 방지합니다.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
