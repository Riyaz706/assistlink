
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def test_supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set")
        return
    
    print(f"Testing Supabase client for: {url}")
    try:
        supabase = create_client(url, key)
        # Try a simple select from a common table
        response = supabase.table("users").select("count", count="exact").limit(1).execute()
        print("SUCCESS: Supabase client connected and fetched data!")
        print(f"Data: {response.data}")
    except Exception as e:
        print(f"FAILED: Supabase client error: {e}")

if __name__ == "__main__":
    test_supabase_client()
