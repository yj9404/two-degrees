import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Matching
from main import _build_matching_response
from schemas import Gender

engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Create dummy users with required fields
user_a = User(
    id="user_a",
    name="A",
    gender=Gender.MALE,
    birth_year=1990,
    job="Engineer",
    contact="1234567890",
    password_hash="hash",
    instagram_id="a",
    active_area="Seoul",
    referrer_name="RefA",
    desired_conditions="{}",
    deal_breakers="{}"
)
user_b = User(
    id="user_b",
    name="B",
    gender=Gender.FEMALE,
    birth_year=1992,
    job="Designer",
    contact="0987654321",
    password_hash="hash",
    instagram_id="b",
    active_area="Seoul",
    referrer_name="RefB",
    desired_conditions="{}",
    deal_breakers="{}"
)
db.add_all([user_a, user_b])
db.commit()

# Set normalized_contact after init if it's not a direct column or handled via event
try:
    user_a.normalized_contact = "1234567890"
    user_b.normalized_contact = "0987654321"
    db.commit()
except Exception:
    pass

matching = Matching(id="m1", user_a_id="user_a", user_b_id="user_b")
db.add(matching)
db.commit()

# Warm up
_build_matching_response(matching, db)

start = time.time()
for _ in range(1000):
    _build_matching_response(matching, db)
end = time.time()
print(f"Baseline Time (1000 calls): {end - start:.4f} seconds")
