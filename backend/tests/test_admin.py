import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_admin_login_success(client, monkeypatch):
    """
    [Admin API] 관리자 로그인 성공 케이스
    """
    monkeypatch.setenv("ADMIN_PASSWORD", "test_admin_pass")

    payload = {"password": "test_admin_pass"}
    response = client.post("/api/admin/login", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_admin_login_wrong_password(client, monkeypatch):
    """
    [Admin API] 관리자 로그인 실패 (비밀번호 불일치)
    """
    monkeypatch.setenv("ADMIN_PASSWORD", "test_admin_pass")

    payload = {"password": "wrong_password"}
    response = client.post("/api/admin/login", json=payload)

    assert response.status_code == 401
    assert "관리자 비밀번호가 올바르지 않습니다" in response.json()["detail"]

def test_admin_login_no_password_env(client, monkeypatch):
    """
    [Admin API] 관리자 로그인 실패 (환경변수 미설정)
    """
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    payload = {"password": "any_password"}
    response = client.post("/api/admin/login", json=payload)

    assert response.status_code == 503
    assert "관리자 비밀번호가 설정되지 않았습니다" in response.json()["detail"]
