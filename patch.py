import re

with open("backend/tests/test_ai_recommend.py", "r") as f:
    content = f.read()

# Replace time.sleep and use explicit datetime mapping
old_code = """    # 2. Add some history records
    import time
    from datetime import datetime, timezone

    # History 1 for Target 1
    history1 = AiRecommendHistory(
        target_user_id=target_id_1,
        candidate_results={candidate_id: {"score": 85, "reason": "Good match"}},
    )
    db_session.add(history1)
    db_session.commit()
    time.sleep(0.1)  # Ensure different created_at

    # History 2 for Target 2
    history2 = AiRecommendHistory(
        target_user_id=target_id_2,
        candidate_results={candidate_id: {"score": 90, "reason": "Better match"}},
    )
    db_session.add(history2)
    db_session.commit()
    time.sleep(0.1)

    # History 3 for Target 1 (latest)
    history3 = AiRecommendHistory(
        target_user_id=target_id_1,
        candidate_results={candidate_id: {"score": 95, "reason": "Best match"}},
    )
    db_session.add(history3)
    db_session.commit()"""

new_code = """    # 2. Add some history records
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc)

    # History 1 for Target 1 (oldest)
    history1 = AiRecommendHistory(
        target_user_id=target_id_1,
        candidate_results={candidate_id: {"score": 85, "reason": "Good match"}},
        created_at=now - timedelta(days=2)
    )
    db_session.add(history1)

    # History 2 for Target 2 (middle)
    history2 = AiRecommendHistory(
        target_user_id=target_id_2,
        candidate_results={candidate_id: {"score": 90, "reason": "Better match"}},
        created_at=now - timedelta(days=1)
    )
    db_session.add(history2)

    # History 3 for Target 1 (latest)
    history3 = AiRecommendHistory(
        target_user_id=target_id_1,
        candidate_results={candidate_id: {"score": 95, "reason": "Best match"}},
        created_at=now
    )
    db_session.add(history3)
    db_session.commit()"""

content = content.replace(old_code, new_code)

with open("backend/tests/test_ai_recommend.py", "w") as f:
    f.write(content)
