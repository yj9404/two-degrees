import asyncio
from datetime import datetime, timezone
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, AiRecommendHistory, Gender
from sqlalchemy import func

engine = create_engine('sqlite:///:memory:')
Session = sessionmaker(bind=engine)

Base.metadata.create_all(engine)

session = Session()

for i in range(100):
    for j in range(50):
        hist = AiRecommendHistory(
            target_user_id=f"user_{i}",
            candidate_results={"c1": {"score": 80, "reason": "ok"}},
            created_at=datetime.now(timezone.utc)
        )
        session.add(hist)

session.commit()

def optimized_subquery(session):
    start = time.time()
    tids = [f"user_{i}" for i in range(100)]

    # Use subquery to get max created_at for each target user
    subq = (
        session.query(
            AiRecommendHistory.target_user_id,
            func.max(AiRecommendHistory.created_at).label('max_created_at')
        )
        .filter(AiRecommendHistory.target_user_id.in_(tids))
        .group_by(AiRecommendHistory.target_user_id)
        .subquery()
    )

    all_hists = (
        session.query(AiRecommendHistory)
        .join(
            subq,
            (AiRecommendHistory.target_user_id == subq.c.target_user_id) &
            (AiRecommendHistory.created_at == subq.c.max_created_at)
        )
        .all()
    )

    latest_hists_map = {hist.target_user_id: hist for hist in all_hists}

    for tid in tids:
        latest_hist = latest_hists_map.get(tid)
        if latest_hist:
            latest_hist.candidate_results = {"c1": {"score": 90, "reason": "optimized"}}
            latest_hist.created_at = datetime.now(timezone.utc)
            session.add(latest_hist)
        else:
            session.add(AiRecommendHistory(
                target_user_id=tid,
                candidate_results={"c1": {"score": 90, "reason": "optimized"}},
            ))
    session.commit()
    end = time.time()
    return end - start

# Run optimized
print(f"Optimized Phase 3 time: {optimized_subquery(session):.4f}s")
