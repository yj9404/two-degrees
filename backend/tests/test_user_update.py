import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app, verify_admin
from models import User, Gender

# ---------------------------------------------------------------------------
# 테스트 환경 설정 (인메모리 SQLite DB)
# ---------------------------------------------------------------------------

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    Base.metadata.create_all(bind=engine)
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session():
    """
    각 테스트마다 데이터베이스 테이블을 생성하고,
    테스트 종료 시 테이블을 모두 삭제하여 완벽한 격리를 보장합니다.
    """
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    TestClient를 반환하는 fixture.
    """
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_update_user_success(client, db_session, monkeypatch):
    """
    [User API] 정상적인 유저 프로필 수정 성공 케이스
    """
    # 유저 생성 (DB 직접 삽입)
    user = User(
        name="홍길동",
        gender=Gender.MALE,
        birth_year=1990,
        job="개발자",
        contact="010-1234-5678",
        password_hash="fakehash",
        referrer_name="김철수",
        desired_conditions="성격이 밝고 유머 감각이 있는 분 (10자 이상)",
        deal_breakers="흡연자, 종교 강요 (10자 이상)",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    user_id = user.id

    # 인증 우회
    app.dependency_overrides[verify_admin] = lambda: "admin"

    # 프로필 수정 요청
    update_payload = {
        "job": "시니어 개발자",
        "intro": "안녕하세요, 잘 부탁드립니다.",
        "is_active": False
    }
    response = client.put(f"/api/users/{user_id}", json=update_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["job"] == "시니어 개발자"
    assert data["intro"] == "안녕하세요, 잘 부탁드립니다."
    assert data["is_active"] is False

    # DB 상태 확인
    db_session.refresh(user)
    assert user.job == "시니어 개발자"
    assert user.intro == "안녕하세요, 잘 부탁드립니다."
    assert user.is_active is False


def test_update_user_not_found(client, db_session, monkeypatch):
    """
    [User API] 존재하지 않는 유저 정보 수정 시 404 에러 반환 검증
    """
    # 인증 우회
    app.dependency_overrides[verify_admin] = lambda: "admin"

    non_existent_id = "00000000-0000-0000-0000-000000000000"
    update_payload = {
        "job": "시니어 개발자"
    }
    response = client.put(f"/api/users/{non_existent_id}", json=update_payload)

    assert response.status_code == 404
    assert "해당 유저를 찾을 수 없습니다" in response.json()["detail"]


def test_update_user_too_many_photos(client, db_session, monkeypatch):
    """
    [User API] 사진 업로드 제한(최대 10장) 초과 시 422 에러 반환 검증
    """
    # 유저 생성 (DB 직접 삽입)
    user = User(
        name="홍길동",
        gender=Gender.MALE,
        birth_year=1990,
        job="개발자",
        contact="010-1234-5678",
        password_hash="fakehash",
        referrer_name="김철수",
        desired_conditions="성격이 밝고 유머 감각이 있는 분 (10자 이상)",
        deal_breakers="흡연자, 종교 강요 (10자 이상)",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    user_id = user.id

    # 인증 우회
    app.dependency_overrides[verify_admin] = lambda: "admin"

    # 사진 11장 업로드 요청
    update_payload = {
        "photo_urls": [f"http://example.com/photo{i}.jpg" for i in range(11)]
    }
    response = client.put(f"/api/users/{user_id}", json=update_payload)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert "사진은 최대 10장까지 업로드할 수 있습니다" in response.json()["detail"]
