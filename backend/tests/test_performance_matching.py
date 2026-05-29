import pytest
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import uuid

from main import mark_matching_contact_shared, app
from models import User, Matching
from schemas import MatchStatus
from database import get_db

def test_benchmark_mark_contact_shared(benchmark, db_session: Session):
    # Setup users and matching
    user_a = User(
        id=str(uuid.uuid4()),
        contact="01012345678",
        gender="MALE",
        birth_year=1990,
        name="User A", job="Dev", password_hash="test", referrer_name="ref", desired_conditions="good", deal_breakers="none"
    )
    user_b = User(
        id=str(uuid.uuid4()),
        contact="01087654321",
        gender="FEMALE",
        birth_year=1992,
        name="User B", job="Designer", password_hash="test", referrer_name="ref", desired_conditions="good", deal_breakers="none"
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)

    matching_id = str(uuid.uuid4())
    matching = Matching(
        id=matching_id,
        user_a_id=user_a.id,
        user_b_id=user_b.id,
        user_a_status=MatchStatus.ACCEPTED,
        user_b_status=MatchStatus.ACCEPTED,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1)
    )
    db_session.add(matching)
    db_session.commit()
    db_session.refresh(matching)

    def run_benchmark():
        matching = db_session.query(Matching).filter(Matching.id == matching_id).first()
        matching.user_a_info = db_session.query(User).filter(User.id == matching.user_a_id).first()
        matching.user_b_info = db_session.query(User).filter(User.id == matching.user_b_id).first()
        return matching

    benchmark(run_benchmark)

def test_benchmark_mark_contact_shared_optimized(benchmark, db_session: Session):
    # Setup users and matching
    user_a = User(
        id=str(uuid.uuid4()),
        contact="01011111111",
        gender="MALE",
        birth_year=1990,
        name="User A", job="Dev", password_hash="test", referrer_name="ref", desired_conditions="good", deal_breakers="none"
    )
    user_b = User(
        id=str(uuid.uuid4()),
        contact="01022222222",
        gender="FEMALE",
        birth_year=1992,
        name="User B", job="Designer", password_hash="test", referrer_name="ref", desired_conditions="good", deal_breakers="none"
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)

    matching_id = str(uuid.uuid4())
    matching = Matching(
        id=matching_id,
        user_a_id=user_a.id,
        user_b_id=user_b.id,
        user_a_status=MatchStatus.ACCEPTED,
        user_b_status=MatchStatus.ACCEPTED,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1)
    )
    db_session.add(matching)
    db_session.commit()
    db_session.refresh(matching)

    def run_benchmark():
        matching = db_session.query(Matching).filter(Matching.id == matching_id).first()
        users = db_session.query(User).filter(User.id.in_([matching.user_a_id, matching.user_b_id])).all()
        user_map = {u.id: u for u in users}
        matching.user_a_info = user_map.get(matching.user_a_id)
        matching.user_b_info = user_map.get(matching.user_b_id)
        return matching

    benchmark(run_benchmark)
