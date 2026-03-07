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

# PostgreSQL일 땐 빈 딕셔너리, SQLite일 땐 check_same_thread 지정
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # 커넥션이 끊어졌는지 확인 후 재연결 (SSL connection closed 에러 방지)
    pool_recycle=300,    # 5분마다 커넥션 재순환
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
