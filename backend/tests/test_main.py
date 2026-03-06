import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import User, Matching

# ---------------------------------------------------------------------------
# 테스트 환경 설정 (인메모리 SQLite DB)
# ---------------------------------------------------------------------------

from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db


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
    with TestClient(app) as c:
        yield c


def test_register_user_success(client):
    """
    [User API] 정상적인 유저 등록 성공 케이스
    """
    payload = {
        "name": "홍길동",
        "gender": "MALE",
        "birth_year": 1990,
        "job": "개발자",
        "contact": "010-1234-5678",
        "password": "testpassword",
        "referrer_name": "김철수",
        "desired_conditions": "성격이 밝고 유머 감각이 있는 분",
        "deal_breakers": "흡연자, 종교 강요"
    }
    response = client.post("/api/users", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "홍길동"
    assert data["contact"] == "010-1234-5678"
    assert "password_hash" not in data
    assert "id" in data


def test_register_duplicate_contact(client):
    """
    [User API] 이미 등록된 contact(연락처)로 중복 가입 시도 시 400 에러 반환 검증
    """
    payload = {
        "name": "홍길동",
        "gender": "MALE",
        "birth_year": 1990,
        "job": "개발자",
        "contact": "010-1234-5678",
        "password": "testpassword",
        "referrer_name": "김철수",
        "desired_conditions": "성격이 밝고 유머 감각이 있는 분",
        "deal_breakers": "흡연자, 종교 강요"
    }
    # 첫 번째 등록 성공
    res1 = client.post("/api/users", json=payload)
    assert res1.status_code == 201

    # 두 번째 중복 등록 실패
    res2 = client.post("/api/users", json=payload)
    assert res2.status_code == 400
    assert "이미 등록된 연락처" in res2.json()["detail"]


def test_auth_wrong_password(client):
    """
    [User API] 인증 API(/api/users/auth)에서 비밀번호 불일치 시 401 에러 반환 검증
    """
    payload = {
        "name": "홍길동",
        "gender": "MALE",
        "birth_year": 1990,
        "job": "개발자",
        "contact": "010-1234-5678",
        "password": "correct_password",
        "referrer_name": "김철수",
        "desired_conditions": "성격이 밝고 유머 감각이 있는 분",
        "deal_breakers": "흡연자, 종교 강요"
    }
    client.post("/api/users", json=payload)

    # 비밀번호 불일치 인증 시도
    auth_payload = {
        "contact": "010-1234-5678",
        "password": "wrong_password"
    }
    response = client.post("/api/users/auth", json=auth_payload)

    assert response.status_code == 401
    assert "연락처 또는 비밀번호가 올바르지 않습니다" in response.json()["detail"]


def test_create_matching_success(client):
    """
    [Matching API] 주선자가 정상적으로 매칭(PENDING 상태)을 생성하는 케이스
    """
    # 유저 A 생성
    payload_a = {
        "name": "유저A",
        "gender": "MALE",
        "birth_year": 1990,
        "job": "개발자",
        "contact": "010-1111-1111",
        "password": "testpassword",
        "referrer_name": "김철수",
        "desired_conditions": "성격이 밝고 유머 감각이 있는 분",
        "deal_breakers": "흡연자, 종교 강요"
    }
    res_a = client.post("/api/users", json=payload_a)
    assert res_a.status_code == 201
    user_a_id = res_a.json()["id"]

    # 유저 B 생성
    payload_b = {
        "name": "유저B",
        "gender": "FEMALE",
        "birth_year": 1992,
        "job": "디자이너",
        "contact": "010-2222-2222",
        "password": "testpassword",
        "referrer_name": "김철수",
        "desired_conditions": "친절하고 대화가 잘 통하는 분",
        "deal_breakers": "거짓말을 밥먹듯이 하는 사람"
    }
    res_b = client.post("/api/users", json=payload_b)
    assert res_b.status_code == 201
    user_b_id = res_b.json()["id"]

    # 매칭 생성
    matching_payload = {
        "user_a_id": user_a_id,
        "user_b_id": user_b_id
    }
    res_match = client.post("/api/matchings", json=matching_payload)

    assert res_match.status_code == 201
    data = res_match.json()
    assert data["user_a_status"] == "PENDING"
    assert data["user_b_status"] == "PENDING"
    assert "id" in data


def test_update_matching_invalid_user_id(client):
    """
    [Matching API] 존재하지 않는 user_id로 매칭 상태를 업데이트(PUT) 시도 시 404 에러 반환 검증
    """
    # 유저 A 생성
    payload_a = {
        "name": "유저A",
        "gender": "MALE",
        "birth_year": 1990,
        "job": "개발자",
        "contact": "010-1111-1111",
        "password": "testpassword",
        "referrer_name": "김철수",
        "desired_conditions": "성격이 밝고 유머 감각이 있는 분",
        "deal_breakers": "흡연자, 종교 강요"
    }
    res_a = client.post("/api/users", json=payload_a)
    user_a_id = res_a.json()["id"]

    # 유저 B 생성
    payload_b = {
        "name": "유저B",
        "gender": "FEMALE",
        "birth_year": 1992,
        "job": "디자이너",
        "contact": "010-2222-2222",
        "password": "testpassword",
        "referrer_name": "김철수",
        "desired_conditions": "친절하고 대화가 잘 통하는 분",
        "deal_breakers": "거짓말을 밥먹듯이 하는 사람"
    }
    res_b = client.post("/api/users", json=payload_b)
    user_b_id = res_b.json()["id"]

    # 매칭 생성
    matching_payload = {
        "user_a_id": user_a_id,
        "user_b_id": user_b_id
    }
    res_match = client.post("/api/matchings", json=matching_payload)
    matching_id = res_match.json()["id"]

    # 존재하지 않는 유저 ID로 상태 변경 시도
    invalid_user_id = "00000000-0000-0000-0000-000000000000"
    update_payload = {
        "user_id": invalid_user_id,
        "status": "ACCEPTED"
    }
    res_update = client.put(f"/api/matchings/{matching_id}/status", json=update_payload)

    assert res_update.status_code == 404
    assert "이 매칭에 속하지 않은 유저입니다" in res_update.json()["detail"]
