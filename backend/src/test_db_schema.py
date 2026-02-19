"""
Smoke test script to verify database schema.
Run this to verify tables exist and connection works.

Usage: python src/test_db_schema.py
"""
import sys
import os
import psycopg2

# Handle Windows console encoding for emojis
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "strict")
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer, "strict")

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def get_connection_for_test():
    """Get database connection for testing (direct connection without app config)"""
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        print(f"Using DATABASE_URL connection string")
        return psycopg2.connect(database_url)
    
    # Construct connection from components
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        raise ValueError("SUPABASE_URL or DATABASE_URL environment variable is required")
    
    # Clean up the URL - remove protocol and extract project ref
    clean_url = supabase_url.replace("https://", "").replace("http://", "").strip()
    if clean_url.startswith("@") or "@" in clean_url.split(".")[0]:
        raise ValueError(f"Invalid SUPABASE_URL format: {supabase_url}. Expected format: https://<project-ref>.supabase.co")
    
    project_ref = clean_url.split(".")[0]
    
    db_host = f"db.{project_ref}.supabase.co"
    db_password = os.getenv("SUPABASE_DB_PASSWORD")
    
    if not db_password:
        raise ValueError("SUPABASE_DB_PASSWORD environment variable is required (or use DATABASE_URL)")
    
    print(f"Connecting to: {db_host}")
    print(f"Using project ref: {project_ref}")
    try:
        conn = psycopg2.connect(
            host=db_host,
            database="postgres",
            user="postgres",
            password=db_password,
            port=5432,
            sslmode="require",
            connect_timeout=10
        )
        return conn
    except psycopg2.OperationalError as e:
        # Provide more helpful error message
        error_msg = str(e)
        if "could not translate host name" in error_msg or "could not resolve" in error_msg:
            raise ValueError(
                f"Cannot resolve host '{db_host}'. Please verify:\n"
                f"  1. Your SUPABASE_URL is correct: {supabase_url}\n"
                f"  2. The project ref '{project_ref}' is correct\n"
                f"  3. Your network connection is working\n"
                f"  Expected format: https://<project-ref>.supabase.co"
            ) from e
        elif "password authentication failed" in error_msg:
            raise ValueError(
                f"Authentication failed. Please verify:\n"
                f"  1. Your SUPABASE_DB_PASSWORD is correct\n"
                f"  2. The password hasn't been reset in Supabase dashboard"
            ) from e
        elif "timeout" in error_msg.lower():
            raise ValueError(
                f"Connection timeout. Please verify:\n"
                f"  1. Your network connection is working\n"
                f"  2. Firewall isn't blocking port 5432\n"
                f"  3. Supabase database is accessible"
            ) from e
        # Re-raise other operational errors with context
        raise ValueError(f"Database connection failed: {error_msg}") from e

def test_schema():
    """Test database connection and verify tables exist"""
    conn = None
    try:
        print("Connecting to database...")
        conn = get_connection_for_test()
        
        print("Connected successfully!")
        
        # Get all tables in public schema
        cur = conn.cursor()
        cur.execute("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname='public'
            ORDER BY tablename;
        """)
        
        tables = cur.fetchall()
        
        print(f"\nFound {len(tables)} table(s) in public schema:")
        print("-" * 50)
        
        expected_tables = [
            "users",
            "caregiver_profile",
            "video_call_requests",
            "chat_sessions",
            "bookings",
            "messages"
        ]
        
        found_tables = [row[0] for row in tables]
        
        for table in found_tables:
            marker = "[OK]" if table in expected_tables else "[?]"
            print(f"{marker} {table}")
        
        print("-" * 50)
        
        # Check for expected tables
        missing_tables = set(expected_tables) - set(found_tables)
        if missing_tables:
            print(f"\nWARNING: {len(missing_tables)} expected table(s) not found:")
            for table in missing_tables:
                print(f"   - {table}")
            print("\nTIP: Run database/schema.sql in Supabase SQL Editor to create tables.")
        else:
            print("\nAll expected tables are present!")
        
        # Test a simple query
        print("\nTesting a simple query...")
        cur.execute("SELECT COUNT(*) FROM users;")
        user_count = cur.fetchone()[0]
        print(f"   Users in database: {user_count}")
        
        cur.close()
        print("\nSchema test passed!")
        return True
        
    except Exception as e:
        print(f"\nSchema test failed!")
        print(f"   Error: {str(e)}")
        print("\nTIP: Check your environment variables:")
        print("   - SUPABASE_DB_PASSWORD")
        print("   - DATABASE_URL (optional)")
        print("   - SUPABASE_URL")
        return False
        
    finally:
        if conn:
            conn.close()
            print("\nConnection closed.")

if __name__ == "__main__":
    success = test_schema()
    sys.exit(0 if success else 1)
