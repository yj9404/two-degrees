import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import json

from database import Base, get_db
from main import app, verify_admin
from models import User, Matching, AiRecommendHistory

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
def client(db_session, monkeypatch):
    """
    TestClient를 반환하는 fixture.
    """
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_admin] = lambda: "admin"

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()

def create_mock_user(client, name, gender, contact, referrer_name="Test Referrer"):
    payload = {
        "name": name,
        "gender": gender,
        "birth_year": 1990,
        "job": "Test Job",
        "contact": contact,
        "password": "testpassword",
        "referrer_name": referrer_name,
        "desired_conditions": "Good personality",
        "deal_breakers": "Bad personality"
    }
    response = client.post("/api/users", json=payload)
    return response.json()["id"]

def test_ai_recommend_happy_path(client, monkeypatch):
    """
    Test the happy path for ai_recommend_matchings.
    It should call the mocked get_ai_recommendations and return the parsed results.
    """
    # 1. Create target and candidate users (MUST have different referrers to not be filtered out)
    target_id = create_mock_user(client, "Target User", "MALE", "010-0000-0000", "Referrer A")
    candidate1_id = create_mock_user(client, "Candidate 1", "FEMALE", "010-0000-0001", "Referrer B")
    candidate2_id = create_mock_user(client, "Candidate 2", "FEMALE", "010-0000-0002", "Referrer C")

    # 2. Mock get_ai_recommendations
    def mock_get_ai_recommendations(target, candidates):
        assert target["id"] == target_id
        assert len(candidates) == 2
        return [
            {"candidate_id": candidate1_id, "score": 95, "reason": "Perfect match!"},
            {"candidate_id": candidate2_id, "score": 80, "reason": "Good match!"}
        ]

    import utils.gemini
    monkeypatch.setattr(utils.gemini, "get_ai_recommendations", mock_get_ai_recommendations)

    # 3. Call the API
    payload = {
        "target_user_id": target_id,
        "candidate_user_ids": [candidate1_id, candidate2_id]
    }
    response = client.post("/api/matchings/ai-recommend", json=payload)

    # 4. Assert response
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Results should be sorted by score descending
    assert data[0]["candidate_id"] == candidate1_id
    assert data[0]["score"] == 95
    assert data[0]["reason"] == "Perfect match!"

    assert data[1]["candidate_id"] == candidate2_id
    assert data[1]["score"] == 80
    assert data[1]["reason"] == "Good match!"


def test_ai_recommend_caching(client, monkeypatch, db_session):
    """
    Verify that repeated calls for the same target and candidate use the cached result
    from AiRecommendHistory and do not invoke the mocked API again.
    """
    target_id = create_mock_user(client, "Target User", "MALE", "010-0000-0000", "Referrer A")
    candidate_id = create_mock_user(client, "Candidate 1", "FEMALE", "010-0000-0001", "Referrer B")

    api_call_count = 0

    def mock_get_ai_recommendations(target, candidates):
        nonlocal api_call_count
        api_call_count += 1
        return [
            {"candidate_id": candidate_id, "score": 90, "reason": "First call match!"}
        ]

    import utils.gemini
    monkeypatch.setattr(utils.gemini, "get_ai_recommendations", mock_get_ai_recommendations)

    payload = {
        "target_user_id": target_id,
        "candidate_user_ids": [candidate_id]
    }

    # First call - should hit the API
    response1 = client.post("/api/matchings/ai-recommend", json=payload)
    assert response1.status_code == 200
    assert api_call_count == 1
    assert response1.json()[0]["score"] == 90

    # Second call - should use cache and NOT hit the API
    response2 = client.post("/api/matchings/ai-recommend", json=payload)
    assert response2.status_code == 200
    assert api_call_count == 1  # Still 1!
    assert response2.json()[0]["score"] == 90
    assert response2.json()[0]["reason"] == "First call match!"

    # Verify cache in DB
    history = db_session.query(AiRecommendHistory).filter(AiRecommendHistory.target_user_id == target_id).first()
    assert history is not None
    assert candidate_id in history.candidate_results
    assert history.candidate_results[candidate_id]["score"] == 90


def test_ai_recommend_exclusions(client, monkeypatch, db_session):
    """
    Verify that candidates who are already matched with the target or are currently "busy"
    in another match are filtered out and not sent to the AI API.
    """
    target_id = create_mock_user(client, "Target User", "MALE", "010-0000-0000", "Referrer A")
    # candidate1: will be already matched with target
    candidate1_id = create_mock_user(client, "Candidate 1", "FEMALE", "010-0000-0001", "Referrer B")
    # candidate2: will be busy in another match
    candidate2_id = create_mock_user(client, "Candidate 2", "FEMALE", "010-0000-0002", "Referrer C")
    # other user to match with candidate2
    other_user_id = create_mock_user(client, "Other User", "MALE", "010-0000-0003", "Referrer D")
    # candidate3: valid candidate
    candidate3_id = create_mock_user(client, "Candidate 3", "FEMALE", "010-0000-0004", "Referrer E")

    # Create matching for target and candidate1 (existing match)
    match1 = Matching(user_a_id=target_id, user_b_id=candidate1_id)
    db_session.add(match1)

    # Create matching for candidate2 and other_user (busy match - pending status by default)
    match2 = Matching(user_a_id=candidate2_id, user_b_id=other_user_id)
    db_session.add(match2)

    db_session.commit()

    api_call_count = 0

    def mock_get_ai_recommendations(target, candidates):
        nonlocal api_call_count
        api_call_count += 1
        # Only candidate3 should be passed to the API
        assert len(candidates) == 1
        assert candidates[0]["id"] == candidate3_id
        return [
            {"candidate_id": candidate3_id, "score": 85, "reason": "Valid match!"}
        ]

    import utils.gemini
    monkeypatch.setattr(utils.gemini, "get_ai_recommendations", mock_get_ai_recommendations)

    payload = {
        "target_user_id": target_id,
        "candidate_user_ids": [candidate1_id, candidate2_id, candidate3_id]
    }

    response = client.post("/api/matchings/ai-recommend", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["candidate_id"] == candidate3_id
    assert data[0]["score"] == 85
    assert api_call_count == 1
