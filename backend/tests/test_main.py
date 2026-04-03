from models import User, Matching


def test_cors_origins(client):
    """
    [CORS] 허용된 출처와 허용되지 않은 출처에 대한 CORS 정책 동작 검증
    """
    # 허용된 출처 테스트
    headers_allowed = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET"
    }
    response_allowed = client.options("/api/users/stats", headers=headers_allowed)
    assert response_allowed.status_code == 200
    assert response_allowed.headers.get("access-control-allow-origin") == "http://localhost:3000"

    # 허용되지 않은 출처 테스트
    headers_disallowed = {
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "GET"
    }
    response_disallowed = client.options("/api/users/stats", headers=headers_disallowed)
    assert response_disallowed.status_code == 400




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


def test_create_matching_success(client, monkeypatch):
    """
    [Matching API] 주선자가 정상적으로 매칭(PENDING 상태)을 생성하는 케이스
    """
    monkeypatch.setenv("ADMIN_PASSWORD", "testadmin")
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

    # 관리자 로그인으로 토큰 획득
    login_res = client.post("/api/admin/login", json={"password": "testadmin"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 매칭 생성
    matching_payload = {
        "user_a_id": user_a_id,
        "user_b_id": user_b_id
    }
    res_match = client.post("/api/matchings", json=matching_payload, headers=headers)

    assert res_match.status_code == 201
    data = res_match.json()
    assert data["user_a_status"] == "PENDING"
    assert data["user_b_status"] == "PENDING"
    assert "id" in data


def test_update_matching_invalid_user_id(client, monkeypatch):
    """
    [Matching API] 존재하지 않는 user_id로 매칭 상태를 업데이트(PUT) 시도 시 404 에러 반환 검증
    """
    monkeypatch.setenv("ADMIN_PASSWORD", "testadmin")
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

    # 관리자 로그인으로 토큰 획득
    login_res = client.post("/api/admin/login", json={"password": "testadmin"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 매칭 생성
    matching_payload = {
        "user_a_id": user_a_id,
        "user_b_id": user_b_id
    }
    res_match = client.post("/api/matchings", json=matching_payload, headers=headers)
    matching_id = res_match.json()["id"]

    # 존재하지 않는 유저 ID로 상태 변경 시도
    invalid_user_id = "00000000-0000-0000-0000-000000000000"
    update_payload = {
        "user_id": invalid_user_id,
        "status": "ACCEPTED"
    }
    res_update = client.put(f"/api/matchings/{matching_id}/status", json=update_payload, headers=headers)

    assert res_update.status_code == 404
    assert "이 매칭에 속하지 않은 유저입니다" in res_update.json()["detail"]
