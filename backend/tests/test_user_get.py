from models import User, Matching, Gender, MatchStatus


def test_get_user_success_no_matches(client, db_session):
    """
    [User API] 유저 조회 성공 케이스 (매칭 내역 없음)
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

    # 유저 조회
    response = client.get(f"/api/users/{user_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user_id
    assert data["name"] == "홍길동"
    assert data["match_count"] == 0


def test_get_user_success_with_matches(client, db_session):
    """
    [User API] 유저 조회 성공 케이스 (매칭 내역 포함)
    """
    # 유저 A 생성
    user_a = User(
        name="유저A", gender=Gender.MALE, birth_year=1990, job="개발자",
        contact="010-1111-1111", password_hash="fake", referrer_name="김",
        desired_conditions="조건1조건2조건3조건4", deal_breakers="기피1기피2기피3기피4"
    )
    # 유저 B 생성
    user_b = User(
        name="유저B", gender=Gender.FEMALE, birth_year=1992, job="디자이너",
        contact="010-2222-2222", password_hash="fake", referrer_name="김",
        desired_conditions="조건1조건2조건3조건4", deal_breakers="기피1기피2기피3기피4"
    )
    # 유저 C 생성
    user_c = User(
        name="유저C", gender=Gender.FEMALE, birth_year=1991, job="교사",
        contact="010-3333-3333", password_hash="fake", referrer_name="박",
        desired_conditions="조건1조건2조건3조건4", deal_breakers="기피1기피2기피3기피4"
    )
    db_session.add_all([user_a, user_b, user_c])
    db_session.commit()

    user_a_id = user_a.id
    user_b_id = user_b.id
    user_c_id = user_c.id

    # 매칭 생성 (A-B)
    match1 = Matching(user_a_id=user_a_id, user_b_id=user_b_id)
    db_session.add(match1)
    db_session.commit()

    # 유저 A 조회 (매칭 1개)
    response = client.get(f"/api/users/{user_a_id}")
    assert response.status_code == 200
    assert response.json()["match_count"] == 1

    # 매칭 추가 생성 (A-C)
    match2 = Matching(user_a_id=user_a_id, user_b_id=user_c_id)
    db_session.add(match2)
    db_session.commit()

    # 유저 A 조회 (매칭 2개)
    response = client.get(f"/api/users/{user_a_id}")
    assert response.status_code == 200
    assert response.json()["match_count"] == 2


def test_get_user_not_found(client):
    """
    [User API] 존재하지 않는 유저 조회 시 404 에러 반환 검증
    """
    non_existent_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(f"/api/users/{non_existent_id}")

    assert response.status_code == 404
    assert "해당 유저를 찾을 수 없습니다" in response.json()["detail"]
