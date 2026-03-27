import time
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, get_db, verify_admin
from database import Base, SessionLocal
from models import User, Matching, Gender

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create 200 users
    users = []
    for i in range(200):
        u = User(
            name=f"User {i}",
            gender=Gender.MALE if i % 2 == 0 else Gender.FEMALE,
            birth_year=1990 + (i % 10),
            job="Engineer",
            contact=f"010-0000-{i:04d}",
            password_hash="hash",
            referrer_name="Ref",
            desired_conditions="Good"*3, # >= 10 chars
            deal_breakers="Bad"*4 # >= 10 chars
        )
        db.add(u)
        users.append(u)
    db.commit()

    # Create 100 matchings
    for i in range(100):
        m = Matching(
            user_a_id=users[i*2].id,
            user_b_id=users[i*2+1].id
        )
        db.add(m)
    db.commit()
    db.close()

def benchmark_list_matchings():
    setup_data()
    app.dependency_overrides[verify_admin] = lambda: "admin"

    start_time = time.time()
    for _ in range(20):
        response = client.get("/api/matchings")
        assert response.status_code == 200, response.text

    end_time = time.time()
    print(f"BASELINE: Time taken for 20 requests of 100 matchings: {end_time - start_time:.4f} seconds")

if __name__ == "__main__":
    benchmark_list_matchings()
