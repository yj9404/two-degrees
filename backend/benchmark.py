import time
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import Base
from models import User, Matching, MatchStatus
from schemas import Gender, MarriageIntent, ChildPlan
from datetime import datetime, timezone

def setup_db():
    engine = create_engine('sqlite:///:memory:', echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()

def run_benchmark():
    session = setup_db()

    # Create users
    users = []
    for i in range(2000):
        # Fill in required NOT NULL constraints
        u = User(
            id=f"user_{i}",
            name=f"User {i}",
            gender=Gender.MALE,
            birth_year=1990,
            job="Engineer",
            contact=f"123-456-{i}",
            password_hash="hash",
            referrer_name="Ref",
            desired_conditions="Cond",
            deal_breakers="Break",
            marriage_intent=MarriageIntent.UNKNOWN,
            child_plan=ChildPlan.UNKNOWN,
            penalty_points=0.0,
            total_penalty_points=0.0
        )
        users.append(u)
    session.add_all(users)
    session.commit()

    penalty_targets = [(f"user_{i}", 1.0) for i in range(2000)]
    now = datetime.now(timezone.utc)

    start = time.time()

    # --- Current Implementation ---
    for user_id, points in penalty_targets:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            continue
        user.penalty_points = (user.penalty_points or 0.0) + points
        user.total_penalty_points = (user.total_penalty_points or 0.0) + points

        if user.penalty_points >= 3.0:
            user.penalty_until = now
            user.suspension_count = (user.suspension_count or 0) + 1

    session.commit()
    end = time.time()
    print(f"Sequential N+1 took: {end - start:.4f} seconds")

    # Reset
    session.rollback()
    for u in session.query(User).all():
        u.penalty_points = 0.0
        u.total_penalty_points = 0.0
    session.commit()

    # Try optimized
    start = time.time()
    user_ids = [uid for uid, _ in penalty_targets]
    users_dict = {u.id: u for u in session.query(User).filter(User.id.in_(user_ids)).all()}

    for user_id, points in penalty_targets:
        user = users_dict.get(user_id)
        if not user:
            continue
        user.penalty_points = (user.penalty_points or 0.0) + points
        user.total_penalty_points = (user.total_penalty_points or 0.0) + points

        if user.penalty_points >= 3.0:
            user.penalty_until = now
            user.suspension_count = (user.suspension_count or 0) + 1

    session.commit()
    end = time.time()
    print(f"Optimized IN clause took: {end - start:.4f} seconds")


if __name__ == "__main__":
    run_benchmark()
