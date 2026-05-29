import time
import os
import sys
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Matching, Gender, MatchStatus

# Create an in-memory SQLite database
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)
db = TestingSessionLocal()

# Seed database
males = [User(id=str(uuid.uuid4()), name=f"Male {i}", gender=Gender.MALE, birth_year=1990, job="Engineer", contact=f"010-0000-{i:04d}", password_hash="dummy", referrer_name="ref", desired_conditions="none", deal_breakers="none", is_active=True) for i in range(20)]
females = [User(id=str(uuid.uuid4()), name=f"Female {i}", gender=Gender.FEMALE, birth_year=1992, job="Designer", contact=f"010-1111-{i:04d}", password_hash="dummy", referrer_name="ref", desired_conditions="none", deal_breakers="none", is_active=True) for i in range(20)]
for u in males + females:
    db.add(u)
db.commit()

# Create dummy matches
all_matches = []
for i in range(10):
    sorted_ids = sorted([males[i].id, females[i].id])
    m = Matching(user_a_id=sorted_ids[0], user_b_id=sorted_ids[1], ai_score=80)
    db.add(m)
    all_matches.append(m)
db.commit()

matched_pairs = {
    (min(m.user_a_id, m.user_b_id), max(m.user_a_id, m.user_b_id))
    for m in all_matches
}

import random
random.seed(42) # For reproducible benchmarking

# Benchmark the slow way (with DB query)
start = time.time()
for _ in range(1000):
    male = random.choice(males)
    female = random.choice(females)

    pair_key = (min(male.id, female.id), max(male.id, female.id))
    if pair_key in matched_pairs:
        continue

    sorted_ids = sorted([male.id, female.id])
    existing = db.query(Matching).filter(
        Matching.user_a_id == sorted_ids[0],
        Matching.user_b_id == sorted_ids[1],
    ).first()

end = time.time()
print(f"With DB query (Baseline): {end - start:.4f}s")

# Benchmark the fast way (without DB query)
random.seed(42) # Reset seed to have identical selections
start = time.time()
for _ in range(1000):
    male = random.choice(males)
    female = random.choice(females)

    pair_key = (min(male.id, female.id), max(male.id, female.id))
    if pair_key in matched_pairs:
        continue

    # existing is simply not queried, we use the matched_pairs set check
    existing = False

end = time.time()
print(f"Without DB query (Optimized): {end - start:.4f}s")
