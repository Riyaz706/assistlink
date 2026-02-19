import requests
import json
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt
import sys
import os

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import supabase_admin, supabase
from app.config import settings

BASE_URL = "http://127.0.0.1:8000"

def generate_test_token(user_id, email):
    """Generate a valid JWT token for testing"""
    access_token_expires = timedelta(days=1)
    access_token = jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "exp": datetime.utcnow() + access_token_expires
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    return access_token

def get_or_create_test_user(role, name):
    email = f"test_{role}_bypass@example.com"
    password = "password123"
    print(f"\n[INFO] Getting/Creating {role}: {email}")
    
    user_id = None
    
    # 1. Check if user exists in Auth
    try:
        # List users (inefficient but works for test)
        users = supabase_admin.auth.admin.list_users()
        for user in users:
            if user.email == email:
                user_id = user.id
                print(f"[INFO] User already exists in Auth: {user_id}")
                break
    except Exception as e:
        print(f"[ERROR] Failed to list users: {e}")

    # 2. Create if not exists
    if not user_id:
        try:
            user_response = supabase_admin.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": name, "role": role}
            })
            user_id = user_response.user.id
            print(f"[SUCCESS] Created new user in Auth: {user_id}")
        except Exception as e:
            print(f"[ERROR] Failed to create user in Auth: {e}")
            return None, None

    # 3. Ensure profile exists in 'users' table
    try:
        # Check profile
        profile = supabase_admin.table("users").select("id").eq("id", user_id).execute()
        if not profile.data:
            print(f"[INFO] Creating profile for {user_id}")
            supabase_admin.table("users").insert({
                "id": user_id,
                "email": email,
                "full_name": name,
                "role": role,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            
            # If caregiver, create caregiver profile
            if role == "caregiver":
                # Check caregiver profile
                cp = supabase_admin.table("caregiver_profile").select("id").eq("user_id", user_id).execute()
                if not cp.data:
                    supabase_admin.table("caregiver_profile").insert({
                        "user_id": user_id,
                        "availability_status": "available",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
        else:
            print(f"[INFO] Profile already exists for {user_id}")
            # Ensure caregiver profile exists if role is caregiver
            if role == "caregiver":
                cp = supabase_admin.table("caregiver_profile").select("id").eq("user_id", user_id).execute()
                if not cp.data:
                    supabase_admin.table("caregiver_profile").insert({
                        "user_id": user_id,
                        "availability_status": "available",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }).execute()

    except Exception as e:
        print(f"[ERROR] Failed to ensure profile: {e}")
        return None, None

    # 4. Generate Token
    token = generate_test_token(user_id, email)
    return token, user_id

def create_video_call_request(recipient_token, caregiver_id):
    print(f"\n[INFO] Creating Video Call Request...")
    
    headers = {"Authorization": f"Bearer {recipient_token}"}
    
    # Schedule for 1 hour from now
    scheduled_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    
    payload = {
        "caregiver_id": caregiver_id,
        "scheduled_time": scheduled_time,
        "duration_seconds": 15
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/bookings/video-call/request", 
            json=payload, 
            headers=headers
        )
        
        print(f"[INFO] Status Code: {response.status_code}")
        print(f"[INFO] Response Body: {response.text}")
        
        if response.status_code == 201:
            print("[SUCCESS] Video Call Request Created Successfully!")
            return True
        else:
            print("[FAILURE] Video Call Request Creation Failed.")
            return False
            
    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        return False

def main():
    print("=== STARTING REPRODUCTION SCRIPT (BYPASS MODE) ===")
    
    # 1. Get/Create Caregiver
    caregiver_token, caregiver_id = get_or_create_test_user("caregiver", "Test Caregiver Bypass")
    if not caregiver_id:
        print("[FATAL] Could not get/create caregiver. Exiting.")
        return

    # 2. Get/Create Care Recipient
    recipient_token, recipient_id = get_or_create_test_user("care_recipient", "Test Recipient Bypass")
    if not recipient_token:
        print("[FATAL] Could not get/create recipient. Exiting.")
        return
        
    # 3. Create Video Call Request
    success = create_video_call_request(recipient_token, caregiver_id)
    
    if success:
        print("\n=== TEST PASSED: Backend is working correctly ===")
    else:
        print("\n=== TEST FAILED: Backend issue detected ===")

if __name__ == "__main__":
    main()
