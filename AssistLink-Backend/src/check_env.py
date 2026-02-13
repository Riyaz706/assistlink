"""
Quick script to check environment variables (without exposing sensitive data)
"""
import os
from dotenv import load_dotenv

load_dotenv()

print("Environment Variables Check:")
print("-" * 50)

database_url = os.getenv("DATABASE_URL")
supabase_url = os.getenv("SUPABASE_URL")
db_password = os.getenv("SUPABASE_DB_PASSWORD")

if database_url:
    # Mask the password in the URL
    if "@" in database_url:
        parts = database_url.split("@")
        if len(parts) == 2:
            user_pass = parts[0].split("://")[-1] if "://" in parts[0] else parts[0]
            if ":" in user_pass:
                user = user_pass.split(":")[0]
                masked_url = database_url.split(":")[0] + "://" + user + ":***@" + parts[1]
            else:
                masked_url = database_url.replace(database_url.split("@")[0].split("://")[-1].split(":")[-1], "***")
        else:
            masked_url = "***MALFORMED*** (contains multiple @ symbols)"
    else:
        masked_url = database_url
    print(f"DATABASE_URL: {masked_url}")
    print(f"  Length: {len(database_url)} characters")
else:
    print("DATABASE_URL: Not set")

if supabase_url:
    print(f"SUPABASE_URL: {supabase_url}")
else:
    print("SUPABASE_URL: Not set")

if db_password:
    print(f"SUPABASE_DB_PASSWORD: {'*' * min(len(db_password), 10)} (length: {len(db_password)})")
else:
    print("SUPABASE_DB_PASSWORD: Not set")

print("-" * 50)
print("\nExpected DATABASE_URL format:")
print("postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres?sslmode=require")
print("\nOr use SUPABASE_URL + SUPABASE_DB_PASSWORD instead")


