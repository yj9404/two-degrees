import sqlite3
import uuid

def migrate():
    conn = sqlite3.connect('twodegrees.db')
    cursor = conn.cursor()
    
    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(matchings)")
        existing_cols = [col[1] for col in cursor.fetchall()]
        
        # Add missing columns if they don't exist
        if 'user_a_token' not in existing_cols:
            print("Adding user_a_token...")
            cursor.execute("ALTER TABLE matchings ADD COLUMN user_a_token VARCHAR(100)")
            # Fill existing rows with random tokens
            cursor.execute("SELECT id FROM matchings")
            rows = cursor.fetchall()
            for row in rows:
                cursor.execute("UPDATE matchings SET user_a_token = ? WHERE id = ?", (str(uuid.uuid4()), row[0]))
        
        if 'user_b_token' not in existing_cols:
            print("Adding user_b_token...")
            cursor.execute("ALTER TABLE matchings ADD COLUMN user_b_token VARCHAR(100)")
            cursor.execute("SELECT id FROM matchings")
            rows = cursor.fetchall()
            for row in rows:
                cursor.execute("UPDATE matchings SET user_b_token = ? WHERE id = ?", (str(uuid.uuid4()), row[0]))

        if 'expires_at' not in existing_cols:
            print("Adding expires_at...")
            cursor.execute("ALTER TABLE matchings ADD COLUMN expires_at DATETIME")

        if 'ai_score' not in existing_cols:
            print("Adding ai_score...")
            cursor.execute("ALTER TABLE matchings ADD COLUMN ai_score INTEGER")

        if 'ai_reason' not in existing_cols:
            print("Adding ai_reason...")
            cursor.execute("ALTER TABLE matchings ADD COLUMN ai_reason TEXT")

        if 'is_contact_shared' not in existing_cols:
            print("Adding is_contact_shared...")
            cursor.execute("ALTER TABLE matchings ADD COLUMN is_contact_shared BOOLEAN DEFAULT 0 NOT NULL")

        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
