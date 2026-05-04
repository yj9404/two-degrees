import pytest
from main import app, verify_admin
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_admin] = lambda: "admin"
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

from models import Gender


def test_get_user_stats_empty(client):
    """
    [User API] 데이터가 없을 때 유저 통계 계산 결과가 모두 0으로 정상 반환되는지 검증
    """
    response = client.get("/api/users/stats")

    assert response.status_code == 200

    expected_data = {
        "total_active": 0,
        "total_users": 0,
        "total_matchings": 0,
        "male_active": 0,
        "female_active": 0,
        "male_ratio": 0.0,
        "female_ratio": 0.0
    }

    assert response.json() == expected_data


def test_get_user_stats_with_data(client):
    """
    [User API] 여러 유저(남성, 여성 / 활성, 비활성)가 존재할 때
    유저 통계 계산 결과(counts, ratios)가 정상 반환되는지 검증
    """
    base_payload = {
        "birth_year": 1990,
        "job": "개발자",
        "password": "testpassword",
        "referrer_name": "김철수",
        "desired_conditions": "성격이 밝고 유머 감각이 있는 분",
        "deal_breakers": "흡연자, 종교 강요"
    }

    # 1. 활성 남성 유저 1
    client.post("/api/users", json={**base_payload, "name": "남1", "gender": "MALE", "contact": "010-1111-1111"})

    # 2. 비활성 남성 유저 1
    res_m2 = client.post("/api/users", json={**base_payload, "name": "남2", "gender": "MALE", "contact": "010-2222-2222"})
    user_m2_id = res_m2.json()["id"]
    client.put(f"/api/users/{user_m2_id}", json={"is_active": False})

    # 3. 활성 여성 유저 1
    client.post("/api/users", json={**base_payload, "name": "여1", "gender": "FEMALE", "contact": "010-3333-3333"})

    # 4. 활성 여성 유저 2
    client.post("/api/users", json={**base_payload, "name": "여2", "gender": "FEMALE", "contact": "010-4444-4444"})

    # 5. 활성 여성 유저 3
    client.post("/api/users", json={**base_payload, "name": "여3", "gender": "FEMALE", "contact": "010-5555-5555"})

    response = client.get("/api/users/stats")

    assert response.status_code == 200

    # total_users: 5명 (남 2, 여 3)
    # total_active: 4명 (남1, 여1, 여2, 여3)
    # male_active: 1명
    # female_active: 3명
    # male_ratio: 1 / 4 * 100 = 25.0
    # female_ratio: 3 / 4 * 100 = 75.0
    # total_matchings: 0

    expected_data = {
        "total_active": 4,
        "total_users": 5,
        "total_matchings": 0,
        "male_active": 1,
        "female_active": 3,
        "male_ratio": 25.0,
        "female_ratio": 75.0
    }

    assert response.json() == expected_data
