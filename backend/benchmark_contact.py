import time
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import bcrypt

from main import app, get_db
from database import Base
from models import User, Gender

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    users = []
    fake_hash = bcrypt.hashpw(b"testpassword", bcrypt.gensalt()).decode()
    for i in range(1000):
        u = User(
            name=f"User {i}",
            gender=Gender.MALE if i % 2 == 0 else Gender.FEMALE,
            birth_year=1990 + (i % 10),
            job="Engineer",
            contact=f"010-0000-{i:04d}",
            normalized_contact=f"0100000{i:04d}",
            password_hash=fake_hash,
            referrer_name="Ref",
            desired_conditions="Good"*3,
            deal_breakers="Bad"*4
        )
        users.append(u)
    db.add_all(users)
    db.commit()
    db.close()

def benchmark_auth():
    setup_data()

    start_time = time.time()
    for i in range(100):
        # Using correct password so it does the full DB lookup and passes or fails cleanly
        response = client.post("/api/users/auth", json={"contact": f"010-0000-{(999-i):04d}", "password": "testpassword"})
        assert response.status_code == 200

    end_time = time.time()
    print(f"BASELINE: Time taken for 100 auth requests: {end_time - start_time:.4f} seconds")

if __name__ == "__main__":
    benchmark_auth()
