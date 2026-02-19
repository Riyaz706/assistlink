import psycopg2
import sys

# The connection string provided by the user
DB_URL = "postgresql://postgres:j3MLw3cBVDXR5Dpg@db.kpuspxawxrbajzevzwmp.supabase.co:6543/postgres"

def test_connection():
    print(f"Testing connection to: {DB_URL}")
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print("✅ Connection Successful!")
        print(f"Server version: {version}")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print("❌ Connection Failed")
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
