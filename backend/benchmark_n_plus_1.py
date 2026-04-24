import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User, Matching
from database import Base
import uuid

# Use an in-memory SQLite database for benchmarking
engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(bind=engine)
Session = sessionmaker(bind=engine)
db = Session()

# Insert dummy data
user_ids = []
for i in range(1000): # 1000 users
    u = User(
        id=str(uuid.uuid4()),
        name=f"User {i}",
        gender="M",
        birth_year=1990,
        job="Engineer",
        contact=f"010-0000-{i:04d}",
        referrer_name="Ref",
        password_hash="pwd",
        desired_conditions="Good condition test data",
        deal_breakers="Bad condition test data"
    )
    db.add(u)
    user_ids.append(u.id)

for i in range(1000): # 1000 matchings
    m = Matching(
        id=str(uuid.uuid4()),
        user_a_id=user_ids[i],
        user_b_id=user_ids[(i+1) % 1000],
    )
    db.add(m)

db.commit()

from sqlalchemy import or_ as sa_or

# Current implementation
start = time.perf_counter()
for uid in user_ids:
    count = db.query(Matching).filter(
        sa_or(Matching.user_a_id == uid, Matching.user_b_id == uid)
    ).count()
end = time.perf_counter()
baseline_time = end - start
print(f"Baseline Time (N+1): {baseline_time:.4f} seconds")

# Optimized implementation
from sqlalchemy import func
start = time.perf_counter()

match_counts_a = db.query(
    Matching.user_a_id, func.count(Matching.id)
).filter(
    Matching.user_a_id.in_(user_ids)
).group_by(Matching.user_a_id).all()

match_counts_b = db.query(
    Matching.user_b_id, func.count(Matching.id)
).filter(
    Matching.user_b_id.in_(user_ids)
).group_by(Matching.user_b_id).all()

counts_map = {uid: 0 for uid in user_ids}
for uid, count in match_counts_a:
    counts_map[uid] += count
for uid, count in match_counts_b:
    counts_map[uid] += count

for uid in user_ids:
    count = counts_map.get(uid, 0)

end = time.perf_counter()
optimized_time = end - start
print(f"Optimized Time (2 queries): {optimized_time:.4f} seconds")
print(f"Improvement: {baseline_time / optimized_time:.2f}x faster")
