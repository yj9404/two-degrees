import os
import uuid
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect

# .env 파일 로드
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./twodegrees.db")

def migrate():
    print(f"Connecting to database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    
    # SQLite일 때 check_same_thread 지정
    connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # ── matchings 테이블 마이그레이션 ─────────────────────────────
        if "matchings" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("matchings")]
            
            if "user_a_token" not in columns:
                print("Adding user_a_token to matchings...")
                conn.execute(text("ALTER TABLE matchings ADD COLUMN user_a_token VARCHAR(100)"))
                # Fill existing rows with random tokens
                rows = conn.execute(text("SELECT id FROM matchings")).fetchall()
                for row in rows:
                    conn.execute(
                        text("UPDATE matchings SET user_a_token = :token WHERE id = :id"),
                        {"token": str(uuid.uuid4()), "id": row[0]}
                    )
            
            if "user_b_token" not in columns:
                print("Adding user_b_token to matchings...")
                conn.execute(text("ALTER TABLE matchings ADD COLUMN user_b_token VARCHAR(100)"))
                rows = conn.execute(text("SELECT id FROM matchings")).fetchall()
                for row in rows:
                    conn.execute(
                        text("UPDATE matchings SET user_b_token = :token WHERE id = :id"),
                        {"token": str(uuid.uuid4()), "id": row[0]}
                    )

            if "expires_at" not in columns:
                print("Adding expires_at to matchings...")
                conn.execute(text("ALTER TABLE matchings ADD COLUMN expires_at TIMESTAMP"))

            if "ai_score" not in columns:
                print("Adding ai_score to matchings...")
                conn.execute(text("ALTER TABLE matchings ADD COLUMN ai_score INTEGER"))

            if "ai_reason" not in columns:
                print("Adding ai_reason to matchings...")
                conn.execute(text("ALTER TABLE matchings ADD COLUMN ai_reason TEXT"))

            if "is_contact_shared" not in columns:
                print("Adding is_contact_shared to matchings...")
                # PostgreSQL에서는 BOOLEAN, SQLite에서는 0/1 정수나 BOOLEAN 지원 (둘 다 호환되도록 정리)
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE matchings ADD COLUMN is_contact_shared BOOLEAN DEFAULT 0 NOT NULL"))
                else:
                    conn.execute(text("ALTER TABLE matchings ADD COLUMN is_contact_shared BOOLEAN DEFAULT FALSE NOT NULL"))
        else:
            print("matchings table does not exist, skipping.")

        # ── users 테이블 마이그레이션 ─────────────────────────────
        if "users" in inspector.get_table_names():
            user_columns = [c["name"] for c in inspector.get_columns("users")]

            if "marriage_intent" not in user_columns:
                print("Adding marriage_intent to users...")
                conn.execute(text("ALTER TABLE users ADD COLUMN marriage_intent VARCHAR(50) DEFAULT 'UNKNOWN'"))
                conn.execute(text("UPDATE users SET marriage_intent = 'UNKNOWN' WHERE marriage_intent IS NULL"))

            if "child_plan" not in user_columns:
                print("Adding child_plan to users...")
                conn.execute(text("ALTER TABLE users ADD COLUMN child_plan VARCHAR(50) DEFAULT 'UNKNOWN'"))
                conn.execute(text("UPDATE users SET child_plan = 'UNKNOWN' WHERE child_plan IS NULL"))
        else:
            print("users table does not exist, skipping.")

        conn.commit()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()

