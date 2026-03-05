import sqlite3

conn = sqlite3.connect("twodegrees.db")
try:
    conn.execute("ALTER TABLE users ADD COLUMN photo_urls TEXT DEFAULT '[]'")
    conn.commit()
    print("Migration OK: photo_urls column added")
except Exception as e:
    print(f"Skip (already exists?): {e}")
finally:
    conn.close()
