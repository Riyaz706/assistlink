
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def test_pooler():
    supabase_url = os.getenv("SUPABASE_URL")
    db_password = os.getenv("SUPABASE_DB_PASSWORD")
    
    if not supabase_url or not db_password:
        print("Error: SUPABASE_URL and SUPABASE_DB_PASSWORD must be set")
        return
    
    project_ref = supabase_url.replace("https://", "").replace("http://", "").split(".")[0]
    
    # Try ap-south-1 first (IST time hint)
    regions = ["ap-south-1", "us-east-1", "eu-central-1"]
    
    for region in regions:
        pooler_host = f"aws-0-{region}.pooler.supabase.com"
        print(f"\nTesting {region} Pooler: {pooler_host}")
        
        try:
            # Note: For Pooler, username is postgres.[project-ref]
            # Port is 6543 for transaction pooling
            conn = psycopg2.connect(
                host=pooler_host,
                database="postgres",
                user=f"postgres.{project_ref}",
                password=db_password,
                port=6543,
                sslmode="require",
                connect_timeout=10
            )
            print(f"SUCCESS: Connected to {region} Pooler!")
            conn.close()
            return True
        except Exception as e:
            print(f"FAILED: {region} Pooler error: {e}")
    
    return False

if __name__ == "__main__":
    test_pooler()
